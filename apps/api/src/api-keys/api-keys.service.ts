import { createHash } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiError } from '../common/api-error';
import { decryptToken, encryptToken } from '../gmail/token-crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { ApiKeyKind, ApiKeyModel } from './api-keys.model';

const SELECT = { kind: true, last4: true, model: true, credits: true, updatedAt: true } as const;

/**
 * Before Settings existed, the server had one JobHunter token and one Claude key in .env. The
 * first account (the admin) gets each copied into their own Settings the first time they need
 * it; after that .env is not read again and the lines can be deleted.
 */
const ENV_KEYS: Partial<Record<ApiKeyKind, string>> = {
  JOBHUNTER: 'JOBHUNTER_API_TOKEN',
  ANTHROPIC: 'ANTHROPIC_API_KEY',
};

/**
 * Each user's own keys for paid services (JobHunter, Claude, OpenAI). The key itself is stored
 * encrypted (AES-256-GCM, the same lock as Gmail tokens) and only ever leaves this service to
 * call that service from the server. The screens only see the last 4 characters.
 */
@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get key(): Buffer {
    return settingsCipherKey(this.config);
  }

  async list(userId: number): Promise<ApiKeyModel[]> {
    await this.adoptEnvKeys(userId);
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { kind: 'asc' },
      select: SELECT,
    });
  }

  async save(
    userId: number,
    kind: ApiKeyKind,
    value: string,
    model: string | null = null,
  ): Promise<ApiKeyModel> {
    const plain = value.trim();
    if (plain.length < 8 || /\s/.test(plain)) {
      throw apiError(BadRequestException, 'API_KEY_INVALID', 'That does not look like a key.');
    }
    const saved = await this.store(userId, kind, plain, model);
    // Your own token wins: a key lent from the Key pool goes back, and a request waiting is over.
    if (kind === 'JOBHUNTER') await this.leavePool(userId);
    return saved;
  }

  /** Gives back a lent pool key and cancels a waiting request. True when a key went back. */
  async leavePool(userId: number): Promise<boolean> {
    const now = new Date();
    const [returned] = await this.prisma.$transaction([
      this.prisma.poolKey.updateMany({
        where: { userId },
        data: { userId: null, assignedAt: null, used: 0 },
      }),
      this.prisma.keyRequest.updateMany({
        where: { userId, status: 'PENDING' },
        data: { status: 'CANCELED', decidedAt: now },
      }),
    ]);
    return returned.count > 0;
  }

  /**
   * The JobHunter token an import uses: your own first, else the one lent to you from the Key
   * pool (then `poolKeyId` says which, so its credits count towards your limit).
   */
  async jobHunterToken(
    userId: number,
  ): Promise<{ token: string; poolKeyId: number | null } | null> {
    const own = await this.secret(userId, 'JOBHUNTER');
    if (own) return { token: own, poolKeyId: null };
    const lent = await this.prisma.poolKey.findUnique({
      where: { userId },
      select: { id: true, secret: true },
    });
    if (!lent) return null;
    try {
      return { token: decryptToken(lent.secret, this.key), poolKeyId: lent.id };
    } catch {
      this.logger.warn(`Pool key ${lent.id} can no longer be read (SETTINGS_KEY changed?)`);
      return null;
    }
  }

  private store(
    userId: number,
    kind: ApiKeyKind,
    plain: string,
    model: string | null = null,
  ): Promise<ApiKeyModel> {
    const data = {
      secret: encryptToken(plain, this.key),
      last4: plain.slice(-4),
      model: model?.trim() || null,
      credits: null,
    };
    return this.prisma.apiKey.upsert({
      where: { userId_kind: { userId, kind } },
      create: { userId, kind, ...data },
      update: data,
      select: SELECT,
    });
  }

  async remove(userId: number, kind: ApiKeyKind): Promise<boolean> {
    const { count } = await this.prisma.apiKey.deleteMany({ where: { userId, kind } });
    return count > 0;
  }

  /** The key in plain text, for a call from the server. Null when this user has none. */
  async secret(userId: number, kind: ApiKeyKind): Promise<string | null> {
    await this.adoptEnvKeys(userId);
    const row = await this.prisma.apiKey.findUnique({
      where: { userId_kind: { userId, kind } },
      select: { secret: true },
    });
    if (!row) return null;
    try {
      return decryptToken(row.secret, this.key);
    } catch {
      // SETTINGS_KEY or JWT_SECRET changed since it was saved: the user has to paste it again.
      this.logger.warn(`A saved ${kind} key of user ${userId} can no longer be read`);
      return null;
    }
  }

  /** An AI key with its model, for a call from the server. Null when this user has none. */
  async aiKey(
    userId: number,
    kind: ApiKeyKind,
  ): Promise<{ key: string; model: string | null } | null> {
    const key = await this.secret(userId, kind);
    if (!key) return null;
    const row = await this.prisma.apiKey.findUnique({
      where: { userId_kind: { userId, kind } },
      select: { model: true },
    });
    return { key, model: row?.model ?? null };
  }

  /** Changes the AI model used with a saved key; null goes back to the default model. */
  async setModel(userId: number, kind: ApiKeyKind, model: string | null): Promise<ApiKeyModel> {
    const row = await this.prisma.apiKey.findUnique({ where: { userId_kind: { userId, kind } } });
    if (!row) throw apiError(NotFoundException, 'API_KEY_NOT_FOUND', 'Save the key first.');
    return this.prisma.apiKey.update({
      where: { userId_kind: { userId, kind } },
      data: { model: model?.trim() || null },
      select: SELECT,
    });
  }

  /** Remembers JobHunter's "credits left", so Settings can show it without a paid call. */
  async noteCredits(userId: number, kind: ApiKeyKind, credits: number | null): Promise<void> {
    if (credits === null) return;
    await this.prisma.apiKey.updateMany({ where: { userId, kind }, data: { credits } });
  }

  /** Copies each old .env key into the first account's Settings, once. */
  private async adoptEnvKeys(userId: number): Promise<void> {
    const present = (Object.entries(ENV_KEYS) as [ApiKeyKind, string][]).filter(([, name]) =>
      this.config.get<string>(name)?.trim(),
    );
    if (present.length === 0) return;
    // ADMIN sorts before USER: the first admin, or the first account when there is none.
    const first = await this.prisma.user.findFirst({
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
      select: { id: true, adoptedEnvKeys: true },
    });
    if (first?.id !== userId) return;
    const pending = present.filter(([kind]) => !first.adoptedEnvKeys.includes(kind));
    if (pending.length === 0) return;
    for (const [kind, name] of pending) {
      const exists = await this.prisma.apiKey.findUnique({
        where: { userId_kind: { userId, kind } },
        select: { kind: true },
      });
      if (!exists) {
        await this.store(
          userId,
          kind,
          this.config.get<string>(name)?.trim() ?? '',
          envModel(this.config, kind),
        );
      }
      this.logger.log(`Copied ${name} from .env into the Settings of user ${userId}`);
    }
    // Only once: a key you delete later stays deleted, even while .env still has it.
    await this.prisma.user.update({
      where: { id: userId },
      data: { adoptedEnvKeys: { push: pending.map(([kind]) => kind) } },
    });
  }
}

/** SETTINGS_KEY scrambles stored keys; without it, the login secret does. */
export function settingsCipherKey(config: ConfigService): Buffer {
  const secret =
    config.get<string>('SETTINGS_KEY') ||
    config.get<string>('JWT_SECRET') ||
    'dev-only-secret-change-me';
  return createHash('sha256').update(`api-key:${secret}`).digest();
}

/** The Claude model Resume-Matcher used from .env (RM_LLM_MODEL), copied with the key. */
function envModel(config: ConfigService, kind: ApiKeyKind): string | null {
  if (kind !== 'ANTHROPIC') return null;
  const provider = config.get<string>('RM_LLM_PROVIDER')?.trim() || 'anthropic';
  return provider === 'anthropic' ? config.get<string>('RM_LLM_MODEL')?.trim() || null : null;
}
