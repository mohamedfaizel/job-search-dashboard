import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { apiError } from '../common/api-error';
import type { GmailAccount, Prisma } from '../generated/prisma/client';
import { ApplicationStatus, SuggestionState } from '../generated/prisma/enums';
import { JobsService } from '../jobs/jobs.service';
import type { NotificationData } from '../notifications/notifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { classifyMail, clearMailKind, suggestedStatus } from './classify';
import { AccessRevokedError, GmailClient } from './gmail.client';
import type { GmailStatusModel, GmailSyncResultModel, MailSuggestionModel } from './gmail.model';
import type { Candidate } from './match-job';
import { matchJob } from './match-job';
import { decryptToken, encryptToken, tokenKey } from './token-crypto';

/** How far back each check looks, and the most mails it reads per account. */
const LOOK_BACK_DAYS = 14;
const MAX_MAILS = 100;

/** Bell: clear employer emails moved jobs by themselves (Undo there). */
export const MAIL_AUTO = 'MAIL_AUTO';

/** A clear email's move, waiting to be done. */
interface ClearMove {
  id: number;
  jobId: string;
  status: ApplicationStatus;
}

/** Only jobs you applied to can get a reply. */
const WAITING_FOR_REPLY: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.INTERVIEWING,
  ApplicationStatus.OFFER,
];

/**
 * Reads employer replies from your connected Gmail accounts (read-only) and suggests tracker
 * changes. It never changes a status by itself: you approve or dismiss each suggestion.
 */
@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GmailClient,
    private readonly jobs: JobsService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The key that scrambles stored refresh tokens: GMAIL_TOKEN_KEY, else the login secret. */
  private get key(): Buffer {
    return tokenKey(this.config);
  }

  async status(userId: number): Promise<GmailStatusModel> {
    const accounts = await this.prisma.gmailAccount.findMany({
      where: { userId },
      orderBy: { connectedAt: 'asc' },
      select: { id: true, email: true, connectedAt: true, lastSyncAt: true, lastError: true },
    });
    return { configured: this.client.configured, accounts };
  }

  /** Saves a Gmail account after sign-in. Connecting the same address again refreshes it. */
  async connect(userId: number, email: string, refreshToken: string | null): Promise<void> {
    const existing = await this.prisma.gmailAccount.findUnique({
      where: { userId_email: { userId, email } },
      select: { id: true },
    });
    // Google only sends a refresh token on a first consent. Without one we can only keep the old one.
    if (!refreshToken && !existing) {
      throw new Error('Google sent no refresh token');
    }
    const encrypted = refreshToken ? encryptToken(refreshToken, this.key) : undefined;
    await this.prisma.gmailAccount.upsert({
      where: { userId_email: { userId, email } },
      create: { userId, email, refreshToken: encrypted ?? '' },
      update: { ...(encrypted ? { refreshToken: encrypted } : {}), lastError: null },
    });
  }

  async disconnect(userId: number, accountId: number): Promise<boolean> {
    const account = await this.prisma.gmailAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw apiError(NotFoundException, 'GMAIL_ACCOUNT_NOT_FOUND', 'Gmail account not found');
    }
    await this.prisma.gmailAccount.delete({ where: { id: account.id } });
    await this.client.revoke(this.plainToken(account)).catch(() => undefined);
    return true;
  }

  /** Checks every connected account of one user. */
  async syncUser(userId: number): Promise<GmailSyncResultModel> {
    const accounts = await this.prisma.gmailAccount.findMany({ where: { userId } });
    return this.syncAccounts(userId, accounts);
  }

  /** Every hour, for every user. Off with GMAIL_SYNC_ENABLED=false or without a Google client. */
  @Cron('0 * * * *')
  async syncEveryone(): Promise<void> {
    if (this.config.get<string>('GMAIL_SYNC_ENABLED') === 'false' || !this.client.configured)
      return;
    if (this.running) return;
    this.running = true;
    try {
      const accounts = await this.prisma.gmailAccount.findMany();
      const userIds = [...new Set(accounts.map((account) => account.userId))];
      for (const userId of userIds) {
        await this.syncAccounts(
          userId,
          accounts.filter((account) => account.userId === userId),
        );
      }
    } catch (error) {
      this.logger.error(`Hourly Gmail check failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  async suggestions(userId: number): Promise<MailSuggestionModel[]> {
    const rows = await this.prisma.mailSuggestion.findMany({
      where: { userId, state: SuggestionState.PENDING },
      orderBy: { receivedAt: 'desc' },
      include: {
        account: { select: { email: true } },
        job: {
          select: {
            title: true,
            company: { select: { name: true } },
            applications: { where: { userId }, select: { status: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      jobTitle: row.job.title,
      company: row.job.company.name,
      currentStatus: row.job.applications[0]?.status ?? ApplicationStatus.NONE,
      status: row.status,
      accountEmail: row.account.email,
      fromAddress: row.fromAddress,
      subject: row.subject,
      snippet: row.snippet,
      receivedAt: row.receivedAt,
    }));
  }

  /** You agreed: the job moves to the suggested status, like picking it in the tracker. */
  async approve(userId: number, id: number): Promise<boolean> {
    const suggestion = await this.pending(userId, id);
    await this.jobs.updateApplicationStatus(userId, suggestion.jobId, suggestion.status);
    await this.prisma.mailSuggestion.update({
      where: { id },
      data: { state: SuggestionState.APPROVED },
    });
    return true;
  }

  async dismiss(userId: number, id: number): Promise<boolean> {
    await this.pending(userId, id);
    await this.prisma.mailSuggestion.update({
      where: { id },
      data: { state: SuggestionState.DISMISSED },
    });
    return true;
  }

  private async pending(userId: number, id: number) {
    const suggestion = await this.prisma.mailSuggestion.findFirst({ where: { id, userId } });
    if (!suggestion) {
      throw apiError(NotFoundException, 'SUGGESTION_NOT_FOUND', 'Suggestion not found');
    }
    if (suggestion.state !== SuggestionState.PENDING) {
      throw apiError(
        NotFoundException,
        'SUGGESTION_ANSWERED',
        'You already answered this suggestion',
      );
    }
    return suggestion;
  }

  private plainToken(account: GmailAccount): string {
    return decryptToken(account.refreshToken, this.key);
  }

  private async syncAccounts(
    userId: number,
    accounts: GmailAccount[],
  ): Promise<GmailSyncResultModel> {
    const candidates = await this.candidates(userId);
    const auto = await this.autoOn(userId);
    const warnings: string[] = [];
    let suggestions = 0;
    const clear: ClearMove[] = [];
    for (const account of accounts) {
      try {
        const found = await this.syncAccount(account, candidates, auto);
        suggestions += found.pending;
        clear.push(...found.clear);
        await this.prisma.gmailAccount.update({
          where: { id: account.id },
          data: { lastSyncAt: new Date(), lastError: null },
        });
      } catch (error) {
        const reason =
          error instanceof AccessRevokedError
            ? 'Access was revoked. Connect this account again.'
            : 'Gmail could not be read. Try again later.';
        if (!(error instanceof AccessRevokedError)) {
          this.logger.warn(`Gmail check of account ${account.id} failed: ${String(error)}`);
        }
        warnings.push(`${account.email}: ${reason}`);
        await this.prisma.gmailAccount.update({
          where: { id: account.id },
          data: { lastError: reason },
        });
      }
    }
    const { moved, unclear } = await this.moveClear(userId, clear);
    return { accounts: accounts.length, suggestions: suggestions + unclear, moved, warnings };
  }

  /** Settings > Gmail: on unless you turned it off. */
  private async autoOn(userId: number): Promise<boolean> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { mailAutoStatus: true },
    });
    return profile?.mailAutoStatus ?? true;
  }

  /** Settings > Gmail: let clear emails move jobs by themselves, or not. */
  async setAutoStatus(userId: number, on: boolean): Promise<boolean> {
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, mailAutoStatus: on },
      update: { mailAutoStatus: on },
    });
    return on;
  }

  /**
   * Moves the jobs of clear emails, like you would in the tracker, and says so in the bell with
   * an Undo. One move per job: when two clear mails disagree, neither is clear any more.
   */
  private async moveClear(
    userId: number,
    clear: ClearMove[],
  ): Promise<{ moved: number; unclear: number }> {
    const byJob = new Map<string, ClearMove[]>();
    for (const move of clear) byJob.set(move.jobId, [...(byJob.get(move.jobId) ?? []), move]);
    const moves: ClearMove[] = [];
    const unclear: number[] = [];
    const extra: number[] = [];
    for (const [first, ...rest] of byJob.values()) {
      if (!first) continue;
      const group = [first, ...rest];
      if (rest.every((move) => move.status === first.status)) {
        moves.push(first);
        // More mails saying the same: one move is enough.
        extra.push(...rest.map((move) => move.id));
      } else {
        unclear.push(...group.map((move) => move.id));
      }
    }
    // Not clear after all: they wait for your answer like any suggestion.
    if (unclear.length) {
      await this.prisma.mailSuggestion.updateMany({
        where: { id: { in: unclear } },
        data: { state: SuggestionState.PENDING, previousStatus: null },
      });
    }
    if (extra.length) {
      await this.prisma.mailSuggestion.updateMany({
        where: { id: { in: extra } },
        data: { state: SuggestionState.DISMISSED },
      });
    }
    if (moves.length === 0) return { moved: 0, unclear: unclear.length };
    for (const move of moves) {
      await this.jobs.updateApplicationStatus(userId, move.jobId, move.status);
    }
    const jobs = await this.prisma.job.findMany({
      where: { id: { in: moves.map((move) => move.jobId) } },
      select: { id: true, title: true, company: { select: { name: true } } },
    });
    const statusOf = new Map(moves.map((move) => [move.jobId, move.status]));
    await this.notifications.push(userId, MAIL_AUTO, {
      searchName: '',
      count: moves.length,
      fitMin: 0,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company.name,
        fit: 0,
        status: statusOf.get(job.id) ?? null,
      })),
      mailIds: moves.map((move) => move.id),
    });
    return { moved: moves.length, unclear: unclear.length };
  }

  /** Undo in the bell: each job goes back to where it was, unless you moved it since. */
  async undoAuto(userId: number, notificationId: number): Promise<boolean> {
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId, kind: MAIL_AUTO },
    });
    if (!row) {
      throw apiError(NotFoundException, 'NOTIFICATION_NOT_FOUND', 'Notification not found', {
        id: notificationId,
      });
    }
    const data = (row.data ?? {}) as Partial<NotificationData>;
    if (data.undone) return true;
    const mails = await this.prisma.mailSuggestion.findMany({
      where: { userId, id: { in: data.mailIds ?? [] }, state: SuggestionState.AUTO },
      include: {
        job: { select: { applications: { where: { userId }, select: { status: true } } } },
      },
    });
    for (const mail of mails) {
      const now = mail.job.applications[0]?.status ?? ApplicationStatus.NONE;
      if (now === mail.status && mail.previousStatus) {
        await this.jobs.updateApplicationStatus(userId, mail.jobId, mail.previousStatus);
      }
    }
    await this.prisma.$transaction([
      this.prisma.mailSuggestion.updateMany({
        where: { id: { in: mails.map((mail) => mail.id) } },
        data: { state: SuggestionState.DISMISSED },
      }),
      this.prisma.notification.update({
        where: { id: row.id },
        data: { data: { ...data, undone: true } as unknown as Prisma.InputJsonValue },
      }),
    ]);
    return true;
  }

  private async candidates(userId: number): Promise<Candidate[]> {
    const rows = await this.prisma.application.findMany({
      where: { userId, status: { in: WAITING_FOR_REPLY } },
      select: {
        jobId: true,
        status: true,
        createdAt: true,
        job: { select: { company: { select: { name: true } } } },
      },
    });
    return rows.map((row) => ({
      jobId: row.jobId,
      company: row.job.company.name,
      status: row.status,
      since: row.createdAt,
    }));
  }

  /**
   * Reads one account's recent mail and stores the new suggestions. Clear ones (with `auto` on)
   * are stored as AUTO and returned, for {@link moveClear} to move.
   */
  private async syncAccount(
    account: GmailAccount,
    candidates: Candidate[],
    auto: boolean,
  ): Promise<{ pending: number; clear: ClearMove[] }> {
    if (candidates.length === 0) return { pending: 0, clear: [] };
    const access = await this.client.accessToken(this.plainToken(account));
    const mails = await this.client.recentMail(access, LOOK_BACK_DAYS, MAX_MAILS);
    const data = mails.flatMap((mail) => {
      const hit = matchJob(mail, candidates);
      if (!hit) return [];
      const text = `${mail.subject}\n${mail.snippet}`;
      const status = suggestedStatus(classifyMail(text), hit.status);
      if (!status) return [];
      const isClear = auto && clearMailKind(text) === status;
      return [
        {
          userId: account.userId,
          accountId: account.id,
          jobId: hit.jobId,
          messageId: mail.id,
          fromAddress: mail.from.slice(0, 300),
          subject: mail.subject.slice(0, 300),
          snippet: mail.snippet.slice(0, 500),
          receivedAt: mail.receivedAt,
          status,
          state: isClear ? SuggestionState.AUTO : SuggestionState.PENDING,
          previousStatus: isClear ? hit.status : null,
        },
      ];
    });
    const created = await this.prisma.mailSuggestion.createManyAndReturn({
      data,
      skipDuplicates: true,
      select: { id: true, jobId: true, status: true, state: true },
    });
    return {
      pending: created.filter((row) => row.state === SuggestionState.PENDING).length,
      clear: created
        .filter((row) => row.state === SuggestionState.AUTO)
        .map((row) => ({ id: row.id, jobId: row.jobId, status: row.status })),
    };
  }
}
