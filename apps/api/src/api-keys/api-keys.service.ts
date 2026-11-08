import { createHash } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiError } from '../common/api-error';
import { decryptToken, encryptToken } from '../gmail/token-crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { ApiKeyKind, ApiKeyModel } from './api-keys.model';

/**
 * Before Settings existed, the server had one JobHunter token in .env. The first account (the
 * admin) gets it copied into their own Settings the first time they need it; after that .env is
 * not read again and the line can be deleted.
 */
const ENV_KEYS: Partial<Record<ApiKeyKind, string>> = { JOBHUNTER: 'JOBHUNTER_API_TOKEN' };

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

  /** SETTINGS_KEY scrambles stored keys; without it, the login secret does. */
  private get key(): Buffer {
    const secret =
      this.config.get<string>('SETTINGS_KEY') ||
      this.config.get<string>('JWT_SECRET') ||
      'dev-only-secret-change-me';
    return createHash('sha256').update(`api-key:${secret}`).digest();
  }

  async list(userId: number): Promise<ApiKeyModel[]> {
    await this.adoptEnvKeys(userId);
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { kind: 'asc' },
      select: { kind: true, last4: true, model: true, credits: true, updatedAt: true },
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
    return this.store(userId, kind, plain, model);
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
      select: { kind: true, last4: true, model: true, credits: true, updatedAt: true },
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

  /** Remembers JobHunter's "credits left", so Settings can show it without a paid call. */
  async noteCredits(userId: number, kind: ApiKeyKind, credits: number | null): Promise<void> {
    if (credits === null) return;
    await this.prisma.apiKey.updateMany({ where: { userId, kind }, data: { credits } });
  }

  /** Copies the old .env keys into the first account's Settings, once. */
  private async adoptEnvKeys(userId: number): Promise<void> {
    const pending = Object.entries(ENV_KEYS).filter(([, name]) => this.config.get<string>(name));
    if (pending.length === 0) return;
    // ADMIN sorts before USER: the first admin, or the first account when there is none.
    const first = await this.prisma.user.findFirst({
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
      select: { id: true, envKeysAdopted: true },
    });
    if (first?.id !== userId || first.envKeysAdopted) return;
    for (const [kind, name] of pending as [ApiKeyKind, string][]) {
      const exists = await this.prisma.apiKey.findUnique({
        where: { userId_kind: { userId, kind } },
        select: { kind: true },
      });
      if (!exists) await this.store(userId, kind, this.config.get<string>(name)?.trim() ?? '');
      this.logger.log(`Copied ${name} from .env into the Settings of user ${userId}`);
    }
    // Only once: a key you delete later stays deleted, even while .env still has it.
    await this.prisma.user.update({ where: { id: userId }, data: { envKeysAdopted: true } });
  }
}
