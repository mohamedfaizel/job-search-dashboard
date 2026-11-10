import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiError } from '../common/api-error';
import type { AppSetting, Invite, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ID = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export type InviteState = 'ACTIVE' | 'EXPIRED' | 'USED_UP';

/** Can this invite still make an account at `now`? (Canceled ones never get here.) */
export function inviteState(invite: Invite, now = new Date()): InviteState {
  if (invite.expiresAt && invite.expiresAt <= now) return 'EXPIRED';
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return 'USED_UP';
  return 'ACTIVE';
}

/**
 * The settings admins change in the app (Admin › Sign-up & access, Limits), and invite links.
 * Read fresh on every use, so a change works at once without a restart.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** The one settings row. The first read makes it, starting from what .env said. */
  async get(): Promise<AppSetting> {
    const row = await this.prisma.appSetting.findUnique({ where: { id: ID } });
    if (row) return row;
    const cap = Number(this.config.get<string>('DAILY_CREDIT_CAP'));
    return this.prisma.appSetting.upsert({
      where: { id: ID },
      update: {},
      create: {
        id: ID,
        signupMode: this.config.get<string>('ALLOW_SIGNUP') === 'false' ? 'CLOSED' : 'OPEN',
        ...(Number.isFinite(cap) && cap >= 0 ? { dailyCreditCap: cap } : {}),
      },
    });
  }

  async update(data: Prisma.AppSettingUpdateInput): Promise<AppSetting> {
    await this.get();
    return this.prisma.appSetting.update({ where: { id: ID }, data });
  }

  /** SCHEDULER_ENABLED=false in .env switches saved-search runs off, whatever the app says. */
  get schedulerOffInEnv(): boolean {
    return this.config.get<string>('SCHEDULER_ENABLED') === 'false';
  }

  /** STILL_OPEN_CHECK_ENABLED=false in .env switches the nightly check off the same way. */
  get stillOpenOffInEnv(): boolean {
    return this.config.get<string>('STILL_OPEN_CHECK_ENABLED') === 'false';
  }

  async schedulerOn(): Promise<boolean> {
    return !this.schedulerOffInEnv && (await this.get()).schedulerOn;
  }

  async stillOpenOn(): Promise<boolean> {
    return !this.stillOpenOffInEnv && (await this.get()).stillOpenOn;
  }

  /** Invite links that were not canceled, newest first. */
  invites(): Promise<Invite[]> {
    return this.prisma.invite.findMany({
      where: { canceledAt: null },
      orderBy: { id: 'desc' },
    });
  }

  createInvite(expiresInDays: number | null, maxUses: number | null, now = new Date()) {
    return this.prisma.invite.create({
      data: {
        // 128 bits: not guessable, and short enough to paste.
        token: randomBytes(16).toString('base64url'),
        expiresAt: expiresInDays === null ? null : new Date(now.getTime() + expiresInDays * DAY_MS),
        maxUses,
      },
    });
  }

  async cancelInvite(id: number): Promise<number> {
    const { count } = await this.prisma.invite.updateMany({
      where: { id, canceledAt: null },
      data: { canceledAt: new Date() },
    });
    if (count === 0) {
      throw apiError(NotFoundException, 'INVITE_NOT_FOUND', `Invite ${id} not found`, { id });
    }
    return id;
  }

  /** The invite behind this token, if it can still be used. */
  async usableInvite(token: string | null | undefined, now = new Date()): Promise<Invite | null> {
    if (!token) return null;
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.canceledAt || inviteState(invite, now) !== 'ACTIVE') return null;
    return invite;
  }

  /**
   * Uses the invite up by one inside the sign-up's transaction. False when someone else used
   * the last place first, or it expired or was canceled meanwhile.
   */
  async takeInvite(tx: Prisma.TransactionClient, token: string, now = new Date()) {
    const invite = await tx.invite.findUnique({ where: { token } });
    if (!invite || invite.canceledAt || inviteState(invite, now) !== 'ACTIVE') return false;
    const { count } = await tx.invite.updateMany({
      where: { id: invite.id, uses: invite.uses },
      data: { uses: { increment: 1 } },
    });
    return count === 1;
  }
}
