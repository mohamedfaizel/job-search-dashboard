import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error';
import { getErrorMessage } from '../common/errors';
import type { Prisma } from '../generated/prisma/client';
import { FitService } from '../insights/fit.service';
import type { NotificationData } from '../notifications/notifications.service';
import { NotificationsService, TOP_JOBS } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AutopilotJob } from './autopilot';
import { plan, sameTitle } from './autopilot';
import { startOfDay } from './schedule';

export const AUTOPILOT = 'AUTOPILOT';

export interface AutopilotOutcome {
  queued: number;
  hidden: number;
  kept: number;
}

/**
 * Autopilot: after a saved search runs, it sorts the jobs that run put on your list. Good fits go
 * to your Apply queue, closed jobs, duplicates and poor fits are hidden, and the rest stay on Job
 * posts. The bell says what it did, with Undo. It never applies anywhere for you.
 */
@Injectable()
export class AutopilotService {
  private readonly logger = new Logger(AutopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fits: FitService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Runs the search's Autopilot on the jobs added to your list since `startedAt`. Returns null
   * when Autopilot is off or there was nothing new. Never throws: a failure is only logged, so
   * the import itself still counts.
   */
  async afterRun(
    userId: number,
    searchId: number,
    startedAt: Date,
    now = new Date(),
  ): Promise<AutopilotOutcome | null> {
    try {
      return await this.sort(userId, searchId, startedAt, now);
    } catch (error) {
      this.logger.warn(
        `Autopilot for search ${String(searchId)} failed: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /** Takes back what one Autopilot notification did: its jobs leave the queue and show again. */
  async undo(userId: number, notificationId: number): Promise<boolean> {
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId, kind: AUTOPILOT },
    });
    if (!row) {
      throw apiError(NotFoundException, 'NOTIFICATION_NOT_FOUND', 'Notification not found', {
        id: notificationId,
      });
    }
    const data = (row.data ?? {}) as Partial<NotificationData>;
    if (data.undone) return true;
    await this.prisma.$transaction([
      // Only what Autopilot added: a job you queued yourself since then stays.
      this.prisma.applyQueueItem.deleteMany({
        where: { userId, auto: true, jobId: { in: data.queuedIds ?? [] } },
      }),
      this.prisma.hiddenJob.deleteMany({ where: { userId, jobId: { in: data.hiddenIds ?? [] } } }),
      this.prisma.notification.update({
        where: { id: row.id },
        data: { data: { ...data, undone: true } as unknown as Prisma.InputJsonValue },
      }),
    ]);
    return true;
  }

  private async sort(
    userId: number,
    searchId: number,
    startedAt: Date,
    now: Date,
  ): Promise<AutopilotOutcome | null> {
    const search = await this.prisma.savedSearch.findFirst({ where: { id: searchId, userId } });
    if (!search?.autopilot) return null;

    const added = await this.prisma.userJob.findMany({
      where: { userId, addedAt: { gte: startedAt } },
      select: { jobId: true },
    });
    if (added.length === 0) return null;

    await this.fits.ensureFresh(userId);
    const rows = await this.prisma.job.findMany({
      where: { id: { in: added.map((a) => a.jobId) } },
      select: {
        id: true,
        title: true,
        companyId: true,
        visa: true,
        postingStatus: true,
        company: { select: { name: true } },
        fits: { where: { userId }, select: { score: true } },
        applications: { where: { userId }, select: { status: true } },
        applyQueue: { where: { userId }, select: { jobId: true } },
        hiddenBy: { where: { userId }, select: { jobId: true } },
      },
    });

    const duplicates = await this.duplicates(userId, rows);
    const jobs: AutopilotJob[] = rows.map((row) => ({
      id: row.id,
      fit: row.fits[0]?.score ?? null,
      visa: row.visa,
      closed: row.postingStatus !== 'active',
      duplicate: duplicates.has(row.id),
      handled: row.applications.length + row.applyQueue.length + row.hiddenBy.length > 0,
    }));

    const usedToday = await this.prisma.applyQueueItem.count({
      where: { userId, auto: true, addedAt: { gte: startOfDay(now) } },
    });
    const result = plan(search, jobs, search.autoQueueMaxPerDay - usedToday);
    if (result.queue.length === 0 && result.hide.length === 0) return null;

    const last = await this.prisma.applyQueueItem.aggregate({
      where: { userId },
      _max: { position: true },
    });
    const start = (last._max.position ?? 0) + 1;
    await this.prisma.$transaction([
      this.prisma.applyQueueItem.createMany({
        data: result.queue.map((jobId, i) => ({ userId, jobId, position: start + i, auto: true })),
        skipDuplicates: true,
      }),
      this.prisma.hiddenJob.createMany({
        data: result.hide.map((jobId) => ({ userId, jobId })),
        skipDuplicates: true,
      }),
    ]);

    const byId = new Map(rows.map((row) => [row.id, row]));
    const fitOf = new Map(jobs.map((job) => [job.id, job.fit ?? 0]));
    await this.notifications.push(userId, AUTOPILOT, {
      searchName: search.name,
      count: result.queue.length,
      fitMin: search.autoQueueFitMin,
      jobs: result.queue.slice(0, TOP_JOBS).map((id) => ({
        id,
        title: byId.get(id)?.title ?? '',
        company: byId.get(id)?.company.name ?? '',
        fit: fitOf.get(id) ?? 0,
      })),
      hidden: result.hide.length,
      kept: result.keep.length,
      queuedIds: result.queue,
      hiddenIds: result.hide,
    });
    return { queued: result.queue.length, hidden: result.hide.length, kept: result.keep.length };
  }

  /** New jobs whose title, at the same company, was already on your list before this run. */
  private async duplicates(
    userId: number,
    rows: { id: string; title: string; companyId: number }[],
  ): Promise<Set<string>> {
    const newIds = rows.map((row) => row.id);
    const older = await this.prisma.job.findMany({
      where: {
        id: { notIn: newIds },
        companyId: { in: [...new Set(rows.map((row) => row.companyId))] },
        listedFor: { some: { userId } },
      },
      select: { title: true, companyId: true },
    });
    const seen = new Set(older.map((job) => `${String(job.companyId)}|${sameTitle(job.title)}`));
    const found = new Set<string>();
    for (const row of rows) {
      const key = `${String(row.companyId)}|${sameTitle(row.title)}`;
      // The same job twice in one run: the second is the duplicate.
      if (seen.has(key)) found.add(row.id);
      else seen.add(key);
    }
    return found;
  }
}
