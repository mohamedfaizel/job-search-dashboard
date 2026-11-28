import { createHmac } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiKeysService, settingsCipherKey } from '../api-keys/api-keys.service';
import { apiError } from '../common/api-error';
import { getErrorMessage } from '../common/errors';
import { encryptToken } from '../gmail/token-crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type {
  AddPoolKeysResultModel,
  KeyPoolModel,
  MyPoolKeyModel,
  PoolKeyModel,
} from './key-pool.model';
import { MyPoolKeyStateKind, PoolKeyStatus } from './key-pool.model';

/** After an admin says no, the user can ask again this many days later. */
export const ASK_AGAIN_DAYS = 7;
/** Admins hear about it when this many free keys or fewer are left. */
export const LOW_POOL = 2;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A key that is not lent and still has credits (null = not checked yet). */
const FREE = { userId: null, OR: [{ credits: null }, { credits: { gt: 0 } }] };

/** Splits pasted text into tokens: spaces, commas, semicolons and new lines separate them. */
export function splitKeys(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((key) => key.trim())
    .filter(Boolean);
}

/** Same rule as Settings › API keys: at least 8 characters, no spaces. */
const looksLikeKey = (key: string) => key.length >= 8 && key.length <= 500;

/**
 * The Key pool: JobHunter tokens the admins may hand out (paid, or allowed in writing by the
 * provider). A user asks in Settings; an admin approves (or the server does, for a first request
 * with auto-approve on) and the next free key is lent to them. The key never leaves the server:
 * nobody sees it again, not even a part of it, and it is never put in an email.
 */
@Injectable()
export class KeyPoolService {
  private readonly logger = new Logger(KeyPoolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly keys: ApiKeysService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- the user's side ----------

  async mine(userId: number, now = new Date()): Promise<MyPoolKeyModel> {
    // A wait that is over gives the key now, even before the next timed run.
    await this.lendDue(now, userId);
    const [{ poolKeyLimit }, lent, last, free] = await Promise.all([
      this.settings.get(),
      this.prisma.poolKey.findUnique({ where: { userId }, select: { used: true } }),
      this.prisma.keyRequest.findFirst({
        where: { userId, status: { in: ['PENDING', 'DENIED'] } },
        orderBy: { id: 'desc' },
      }),
      this.prisma.poolKey.count({ where: FREE }),
    ]);
    const base = {
      requestedAt: null,
      note: null,
      askAgainAt: null,
      limit: poolKeyLimit,
      used: 0,
      poolEmpty: free === 0,
      readyAt: null,
    };
    if (lent) return { ...base, state: MyPoolKeyStateKind.APPROVED, used: lent.used };
    if (last?.status === 'PENDING') {
      return {
        ...base,
        state: MyPoolKeyStateKind.PENDING,
        requestedAt: last.createdAt,
        readyAt: last.autoAt,
      };
    }
    if (last?.status === 'DENIED' && last.decidedAt) {
      const askAgainAt = new Date(last.decidedAt.getTime() + ASK_AGAIN_DAYS * DAY_MS);
      if (askAgainAt > now) {
        return {
          ...base,
          state: MyPoolKeyStateKind.DENIED,
          requestedAt: last.createdAt,
          note: last.note,
          askAgainAt,
        };
      }
    }
    return { ...base, state: MyPoolKeyStateKind.NONE };
  }

  /**
   * Asks for a key. A first request with auto-approve on gets one by itself: after the wait
   * (Admin › Key pool, 24 hours by default), or at once when the wait is 0 and a key is free.
   */
  async request(userId: number, now = new Date()): Promise<MyPoolKeyModel> {
    if (await this.keys.secret(userId, 'JOBHUNTER')) {
      throw apiError(BadRequestException, 'POOL_HAS_OWN_KEY', 'You already use your own token.');
    }
    const state = await this.mine(userId, now);
    if (state.state === MyPoolKeyStateKind.APPROVED || state.state === MyPoolKeyStateKind.PENDING) {
      return state;
    }
    if (state.state === MyPoolKeyStateKind.DENIED) {
      throw apiError(BadRequestException, 'POOL_ASK_LATER', 'You can ask again later.', {
        askAgainAt: state.askAgainAt?.toISOString() ?? '',
      });
    }
    // The key a new account got at sign-up does not count: the first request you make yourself
    // still comes by itself. Sign-up requests are the only ones that are auto with no autoAt.
    const first =
      (await this.prisma.keyRequest.count({
        where: { userId, NOT: { auto: true, autoAt: null } },
      })) === 0;
    const { poolAutoApprove, poolWaitHours } = await this.settings.get();
    const auto = first && poolAutoApprove;
    // Every timed request gets autoAt (now when there is no wait), so it counts as asked once.
    const autoAt = auto ? new Date(now.getTime() + poolWaitHours * HOUR_MS) : null;
    const request = await this.prisma.keyRequest.create({ data: { userId, autoAt } });
    if (auto && poolWaitHours === 0 && (await this.lend(request.id, userId, true))) {
      return this.mine(userId, now);
    }
    if (auto && poolWaitHours > 0) await this.tell(userId, 'KEY_WAIT', { count: poolWaitHours });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const free = await this.prisma.poolKey.count({ where: FREE });
    await this.tellAdmins('KEY_REQUEST', {
      name: user?.name ?? '',
      count: free,
      refId: request.id,
    });
    return this.mine(userId, now);
  }

  /**
   * A new account gets a key straight away from the pool, with no wait, when auto-approve is on
   * and a key is free. If not, its first own request in Settings still comes by itself after the
   * wait. Never stops the sign-up: if it fails, the user can still ask in Settings.
   */
  async assignOnSignup(userId: number): Promise<void> {
    try {
      const { poolAutoApprove } = await this.settings.get();
      if (!poolAutoApprove || (await this.prisma.poolKey.count({ where: FREE })) === 0) return;
      const request = await this.prisma.keyRequest.create({ data: { userId } });
      // Taken by someone else meanwhile: forget the request, so asking later still counts as first.
      if (!(await this.lend(request.id, userId, true))) {
        await this.prisma.keyRequest.delete({ where: { id: request.id } });
      }
    } catch (error) {
      this.logger.warn(`No key for new user ${userId}: ${getErrorMessage(error)}`);
    }
  }

  async cancel(userId: number): Promise<MyPoolKeyModel> {
    await this.prisma.keyRequest.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'CANCELED', decidedAt: new Date() },
    });
    return this.mine(userId);
  }

  /** You give your lent key back to the pool. */
  async giveBack(userId: number): Promise<MyPoolKeyModel> {
    await this.keys.leavePool(userId);
    return this.mine(userId);
  }

  /**
   * How many credits an import may still spend with this pool key: the per-user limit minus
   * what its holder spent.
   */
  async allowance(poolKeyId: number): Promise<number> {
    const [{ poolKeyLimit }, key] = await Promise.all([
      this.settings.get(),
      this.prisma.poolKey.findUnique({ where: { id: poolKeyId }, select: { used: true } }),
    ]);
    return Math.max(0, poolKeyLimit - (key?.used ?? 0));
  }

  /** After an import with a pool key: counts its credits and tells the holder if it ran out. */
  async recordUse(poolKeyId: number, charged: number, creditsLeft: number | null): Promise<void> {
    const key = await this.prisma.poolKey.update({
      where: { id: poolKeyId },
      data: {
        used: { increment: charged },
        ...(creditsLeft === null ? {} : { credits: creditsLeft }),
      },
    });
    if (key.userId === null) return;
    const { poolKeyLimit } = await this.settings.get();
    if (creditsLeft === 0) {
      await this.tell(key.userId, 'KEY_EMPTY', {});
    } else if (charged > 0 && key.used >= poolKeyLimit && key.used - charged < poolKeyLimit) {
      await this.tell(key.userId, 'KEY_LIMIT', { count: poolKeyLimit });
    }
  }

  /** Every 10 minutes: requests whose wait is over get their key. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async lendDueTick(): Promise<void> {
    try {
      await this.lendDue(new Date());
    } catch (error) {
      this.logger.warn(`Could not hand out waiting keys: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Gives keys to requests whose wait is over (only `userId`'s, when given), oldest first. With
   * no free key they stay waiting and get the next one; a user with their own token by now is
   * skipped. Returns how many keys were given.
   */
  async lendDue(now: Date, userId?: number): Promise<number> {
    const due = await this.prisma.keyRequest.findMany({
      where: { status: 'PENDING', autoAt: { lte: now }, ...(userId ? { userId } : {}) },
      orderBy: { id: 'asc' },
      select: { id: true, userId: true },
    });
    let given = 0;
    for (const request of due) {
      if (await this.keys.secret(request.userId, 'JOBHUNTER')) continue;
      if (!(await this.lend(request.id, request.userId, true))) break;
      given += 1;
    }
    return given;
  }

  // ---------- the admins' side ----------

  async pool(): Promise<KeyPoolModel> {
    const [settings, keys, requests] = await Promise.all([
      this.settings.get(),
      this.prisma.poolKey.findMany({
        orderBy: { id: 'desc' },
        include: { user: { select: { name: true } } },
      }),
      this.prisma.keyRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { id: 'asc' },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);
    const rows: PoolKeyModel[] = keys.map((key) => ({
      id: key.id,
      status:
        key.credits === 0
          ? PoolKeyStatus.EMPTY
          : key.userId === null
            ? PoolKeyStatus.FREE
            : PoolKeyStatus.ASSIGNED,
      holder: key.user?.name ?? null,
      used: key.userId === null ? 0 : key.used,
      credits: key.credits,
      note: key.note,
      createdAt: key.createdAt,
    }));
    const count = (status: PoolKeyStatus) => rows.filter((row) => row.status === status).length;
    return {
      free: count(PoolKeyStatus.FREE),
      assigned: count(PoolKeyStatus.ASSIGNED),
      empty: count(PoolKeyStatus.EMPTY),
      limit: settings.poolKeyLimit,
      autoApprove: settings.poolAutoApprove,
      waitHours: settings.poolWaitHours,
      keys: rows,
      requests: requests.map((request) => ({
        id: request.id,
        name: request.user.name,
        email: request.user.email,
        createdAt: request.createdAt,
      })),
    };
  }

  /** Adds pasted tokens. Same token twice (or one already in the pool) is skipped. */
  async add(text: string, note = ''): Promise<AddPoolKeysResultModel> {
    const result = { added: 0, duplicates: 0, invalid: 0 };
    const seen = new Set<string>();
    for (const key of splitKeys(text)) {
      if (!looksLikeKey(key)) {
        result.invalid += 1;
        continue;
      }
      const fingerprint = this.fingerprint(key);
      if (seen.has(fingerprint)) {
        result.duplicates += 1;
        continue;
      }
      seen.add(fingerprint);
      const exists = await this.prisma.poolKey.findUnique({ where: { fingerprint } });
      if (exists) {
        result.duplicates += 1;
        continue;
      }
      await this.prisma.poolKey.create({
        data: {
          secret: encryptToken(key, settingsCipherKey(this.config)),
          fingerprint,
          note: note.trim(),
        },
      });
      result.added += 1;
    }
    return result;
  }

  async approve(requestId: number): Promise<KeyPoolModel> {
    const request = await this.pending(requestId);
    if (!(await this.lend(request.id, request.userId, false))) {
      throw apiError(BadRequestException, 'POOL_EMPTY', 'No key is free. Add keys first.');
    }
    return this.pool();
  }

  async deny(requestId: number, note: string | null): Promise<KeyPoolModel> {
    const request = await this.pending(requestId);
    const text = note?.trim() || null;
    await this.prisma.keyRequest.update({
      where: { id: request.id },
      data: { status: 'DENIED', note: text, decidedAt: new Date() },
    });
    await this.tell(request.userId, 'KEY_DENIED', { name: text ?? '' });
    return this.pool();
  }

  /** Takes a lent key back. With `passOn`, it goes to the oldest waiting request instead. */
  async takeBack(keyId: number, passOn: boolean): Promise<KeyPoolModel> {
    const key = await this.prisma.poolKey.findUnique({ where: { id: keyId } });
    if (!key) throw apiError(NotFoundException, 'POOL_KEY_NOT_FOUND', `Key ${keyId} not found`);
    if (key.userId !== null) {
      await this.prisma.poolKey.update({
        where: { id: keyId },
        data: { userId: null, assignedAt: null, used: 0 },
      });
      await this.tell(key.userId, 'KEY_TAKEN_BACK', {});
    }
    if (passOn) {
      const next = await this.prisma.keyRequest.findFirst({
        where: { status: 'PENDING' },
        orderBy: { id: 'asc' },
      });
      if (!next) {
        throw apiError(BadRequestException, 'POOL_NO_REQUEST', 'Nobody is waiting for a key.');
      }
      await this.lend(next.id, next.userId, false, keyId);
    }
    return this.pool();
  }

  /** Deletes a key from the pool. If someone has it, they lose it (and are told). */
  async remove(keyId: number): Promise<KeyPoolModel> {
    const key = await this.prisma.poolKey.findUnique({ where: { id: keyId } });
    if (!key) throw apiError(NotFoundException, 'POOL_KEY_NOT_FOUND', `Key ${keyId} not found`);
    await this.prisma.poolKey.delete({ where: { id: keyId } });
    if (key.userId !== null) await this.tell(key.userId, 'KEY_TAKEN_BACK', {});
    return this.pool();
  }

  // ---------- inside ----------

  /**
   * Lends a free key (or `keyId`) to the request's user and marks the request approved. False
   * when no key is free. A key is taken with a guarded update, so two admins clicking at once
   * can't hand out the same key.
   */
  private async lend(
    requestId: number,
    userId: number,
    auto: boolean,
    keyId?: number,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const key = await this.prisma.poolKey.findFirst({
        where: keyId ? { id: keyId, userId: null } : FREE,
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (!key) return false;
      const taken = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.poolKey.updateMany({
          where: { id: key.id, userId: null },
          data: { userId, assignedAt: new Date(), used: 0 },
        });
        if (count === 0) return false;
        await tx.keyRequest.update({
          where: { id: requestId },
          data: { status: 'APPROVED', auto, decidedAt: new Date() },
        });
        return true;
      });
      if (!taken) continue;
      const { poolKeyLimit } = await this.settings.get();
      await this.tell(userId, 'KEY_APPROVED', { count: poolKeyLimit });
      const free = await this.prisma.poolKey.count({ where: FREE });
      if (free <= LOW_POOL) await this.tellAdmins('POOL_LOW', { count: free });
      return true;
    }
    return false;
  }

  private async pending(requestId: number) {
    const request = await this.prisma.keyRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw apiError(NotFoundException, 'KEY_REQUEST_NOT_FOUND', `Request ${requestId} not found`);
    }
    if (request.status !== 'PENDING') {
      throw apiError(BadRequestException, 'KEY_REQUEST_DONE', 'Someone already answered it.');
    }
    if (await this.keys.secret(request.userId, 'JOBHUNTER')) {
      // They saved their own token meanwhile: nothing to hand out.
      await this.prisma.keyRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELED', decidedAt: new Date() },
      });
      throw apiError(BadRequestException, 'KEY_REQUEST_DONE', 'They use their own token now.');
    }
    return request;
  }

  private fingerprint(key: string): string {
    return createHmac('sha256', settingsCipherKey(this.config)).update(key).digest('hex');
  }

  private async tell(
    userId: number,
    kind: string,
    data: { name?: string; count?: number; refId?: number },
  ): Promise<void> {
    try {
      await this.notifications.push(userId, kind, {
        searchName: data.name ?? '',
        count: data.count ?? 0,
        fitMin: 0,
        jobs: [],
        ...(data.refId ? { refId: data.refId } : {}),
      });
    } catch (error) {
      this.logger.warn(`Could not tell user ${userId} (${kind}): ${getErrorMessage(error)}`);
    }
  }

  private async tellAdmins(
    kind: string,
    data: { name?: string; count?: number; refId?: number },
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', disabledAt: null },
      select: { id: true },
    });
    for (const admin of admins) await this.tell(admin.id, kind, data);
  }
}
