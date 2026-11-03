import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { apiError } from '../common/api-error';
import type { GmailAccount } from '../generated/prisma/client';
import { ApplicationStatus, SuggestionState } from '../generated/prisma/enums';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { classifyMail, suggestedStatus } from './classify';
import { AccessRevokedError, GmailClient } from './gmail.client';
import type { GmailStatusModel, GmailSyncResultModel, MailSuggestionModel } from './gmail.model';
import type { Candidate } from './match-job';
import { matchJob } from './match-job';
import { decryptToken, encryptToken, keyFrom } from './token-crypto';

/** How far back each check looks, and the most mails it reads per account. */
const LOOK_BACK_DAYS = 14;
const MAX_MAILS = 100;

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
  ) {}

  /** The key that scrambles stored refresh tokens: GMAIL_TOKEN_KEY, else the login secret. */
  private get key(): Buffer {
    return keyFrom(
      this.config.get<string>('GMAIL_TOKEN_KEY') ||
        this.config.get<string>('JWT_SECRET') ||
        'dev-only-secret-change-me',
    );
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
    const warnings: string[] = [];
    let suggestions = 0;
    for (const account of accounts) {
      try {
        suggestions += await this.syncAccount(account, candidates);
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
    return { accounts: accounts.length, suggestions, warnings };
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

  /** Reads one account's recent mail and stores the new suggestions. Returns how many. */
  private async syncAccount(account: GmailAccount, candidates: Candidate[]): Promise<number> {
    if (candidates.length === 0) return 0;
    const access = await this.client.accessToken(this.plainToken(account));
    const mails = await this.client.recentMail(access, LOOK_BACK_DAYS, MAX_MAILS);
    const data = mails.flatMap((mail) => {
      const hit = matchJob(mail, candidates);
      if (!hit) return [];
      const status = suggestedStatus(classifyMail(`${mail.subject}\n${mail.snippet}`), hit.status);
      if (!status) return [];
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
        },
      ];
    });
    const created = await this.prisma.mailSuggestion.createMany({ data, skipDuplicates: true });
    return created.count;
  }
}
