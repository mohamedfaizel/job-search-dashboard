import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getErrorMessage } from '../common/errors';
import type { Prisma } from '../generated/prisma/client';
import { FitService } from '../insights/fit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  NotificationJobModel,
  NotificationModel,
  NotificationsModel,
} from './notification.model';

/** How many notifications the bell list shows. Older ones are deleted. */
export const KEEP = 30;
/** How many jobs a "new matches" notification names. */
export const TOP_JOBS = 3;

interface NotificationData {
  searchName: string;
  count: number;
  fitMin: number;
  jobs: NotificationJobModel[];
  /** INTERVIEW_SOON: the interview time, as ISO text. */
  at?: string;
}

/** How long before an interview the bell reminds you. */
export const REMIND_BEFORE_MS = 24 * 60 * 60 * 1000;

function toModel(row: {
  id: number;
  kind: string;
  data: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}): NotificationModel {
  const data = (row.data ?? {}) as Partial<NotificationData>;
  return {
    id: row.id,
    kind: row.kind,
    searchName: data.searchName ?? '',
    count: data.count ?? 0,
    fitMin: data.fitMin ?? 0,
    jobs: Array.isArray(data.jobs) ? data.jobs : [],
    at: data.at ? new Date(data.at) : null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

/**
 * The bell list: one user's notifications. A scheduled search that imports new jobs tells its
 * owner when some of them fit at least their "match" Fit % (Profile > Notifications).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fits: FitService,
  ) {}

  async list(userId: number): Promise<NotificationsModel> {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: KEEP,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items: rows.map(toModel), unread };
  }

  /** Marks all your notifications read. Returns how many were unread. */
  async markAllRead(userId: number): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return count;
  }

  /**
   * After a scheduled search put `jobIds` on `userId`'s list, tells them how many fit them.
   * Users who turned it off, have no Fit scores (no resume) or hid the job are skipped.
   * Returns how many notifications it made.
   */
  async newMatches(searchName: string, jobIds: string[], userId: number): Promise<number> {
    if (jobIds.length === 0) return 0;
    const users = await this.prisma.profile.findMany({
      where: { userId, notifyNewMatches: true },
      select: { userId: true, matchFitMin: true },
    });
    let made = 0;
    for (const { userId, matchFitMin } of users) {
      try {
        await this.fits.ensureFresh(userId);
        const matches = await this.prisma.jobFit.findMany({
          where: {
            userId,
            jobId: { in: jobIds },
            score: { gte: matchFitMin },
            job: { hiddenBy: { none: { userId } } },
          },
          orderBy: { score: 'desc' },
          select: { score: true, job: { select: { id: true, title: true, company: true } } },
        });
        if (matches.length === 0) continue;
        const data: NotificationData = {
          searchName,
          count: matches.length,
          fitMin: matchFitMin,
          jobs: matches.slice(0, TOP_JOBS).map(({ score, job }) => ({
            id: job.id,
            title: job.title,
            company: job.company.name,
            fit: score,
          })),
        };
        await this.add(userId, 'NEW_MATCHES', data);
        made += 1;
      } catch (error) {
        this.logger.warn(
          `Could not tell user ${String(userId)} about new matches: ${getErrorMessage(error)}`,
        );
      }
    }
    return made;
  }

  /**
   * Reminds you in the bell of each interview within the next day, once per date you set.
   * Returns how many reminders it made.
   */
  async interviewReminders(now = new Date()): Promise<number> {
    const due = await this.prisma.application.findMany({
      where: {
        interviewAt: { gt: now, lte: new Date(now.getTime() + REMIND_BEFORE_MS) },
        interviewRemindedAt: null,
      },
      select: {
        userId: true,
        jobId: true,
        interviewAt: true,
        job: { select: { title: true, company: { select: { name: true } } } },
      },
    });
    let made = 0;
    for (const row of due) {
      if (!row.interviewAt) continue;
      try {
        const fit = await this.prisma.jobFit.findUnique({
          where: { userId_jobId: { userId: row.userId, jobId: row.jobId } },
          select: { score: true },
        });
        await this.add(row.userId, 'INTERVIEW_SOON', {
          searchName: '',
          count: 1,
          fitMin: 0,
          jobs: [
            {
              id: row.jobId,
              title: row.job.title,
              company: row.job.company.name,
              fit: fit?.score ?? 0,
            },
          ],
          at: row.interviewAt.toISOString(),
        });
        await this.prisma.application.update({
          where: { userId_jobId: { userId: row.userId, jobId: row.jobId } },
          data: { interviewRemindedAt: now },
        });
        made += 1;
      } catch (error) {
        this.logger.warn(
          `Could not remind user ${String(row.userId)} of an interview: ${getErrorMessage(error)}`,
        );
      }
    }
    return made;
  }

  /** An admin answered your message: `from` is their name, shown as the bell's "search". */
  async messageReply(userId: number, from: string): Promise<void> {
    await this.add(userId, 'MESSAGE_REPLY', { searchName: from, count: 1, fitMin: 0, jobs: [] });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async remindInterviews(): Promise<void> {
    if (process.env['SCHEDULER_ENABLED'] === 'false') return;
    await this.interviewReminders();
  }

  private async add(userId: number, kind: string, data: NotificationData): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, kind, data: data as unknown as Prisma.InputJsonValue },
    });
    // Keep the list short: drop what falls off the end of the bell list.
    const old = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: KEEP,
      select: { id: true },
    });
    if (old.length) {
      await this.prisma.notification.deleteMany({ where: { id: { in: old.map((n) => n.id) } } });
    }
  }
}
