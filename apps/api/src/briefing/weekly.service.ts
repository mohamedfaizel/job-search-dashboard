import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getErrorMessage } from '../common/errors';
import { ApplicationStatus, ScheduleFrequency } from '../generated/prisma/enums';
import { FitService } from '../insights/fit.service';
import { NotificationsService, TOP_JOBS } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import type { SearchWeek, WeeklyCounts } from './weekly';
import { bestSearch, hasWeek, isWeeklyDue, pauseSearch, weeklyText } from './weekly';

export const WEEKLY_REPORT = 'WEEKLY_REPORT';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const REPLIES: ApplicationStatus[] = [
  ApplicationStatus.INTERVIEWING,
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
];

/**
 * The weekly report: on Sunday evening, your week in one summary (applied, replies, good jobs),
 * which saved search found the best jobs, and which scheduled one to pause because it only
 * brings low Fit. In the bell and as a push on your phone. A quiet week sends nothing.
 */
@Injectable()
export class WeeklyService {
  private readonly logger = new Logger(WeeklyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fits: FitService,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  private running = false;

  /**
   * Sundays at 18:00, server time. Checked every 10 minutes, so a Sunday missed while the PC was
   * off goes out as soon as the app runs again.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    if (this.running || this.config.get<string>('SCHEDULER_ENABLED') === 'false') return;
    this.running = true;
    try {
      await this.sendDue(new Date());
    } finally {
      this.running = false;
    }
  }

  /** Sends every report due at `now` (see isWeeklyDue). Returns how many went out. */
  sendDue(now: Date): Promise<number> {
    return this.sendTo(now, true);
  }

  /** Sends the report to everyone who has it on, due or not. Returns how many went out. */
  sendAll(now: Date): Promise<number> {
    return this.sendTo(now, false);
  }

  private async sendTo(now: Date, onlyDue: boolean): Promise<number> {
    const profiles = await this.prisma.profile.findMany({
      where: { weeklyReport: true },
      select: { userId: true, matchFitMin: true, weeklySentAt: true },
    });
    let sent = 0;
    for (const p of profiles) {
      if (onlyDue && !isWeeklyDue(p.weeklySentAt, now)) continue;
      // Booked first, so a failure can't send it twice.
      await this.prisma.profile.update({
        where: { userId: p.userId },
        data: { weeklySentAt: now },
      });
      try {
        if (await this.send(p.userId, p.matchFitMin, now)) sent += 1;
      } catch (error) {
        this.logger.warn(
          `Weekly report for user ${String(p.userId)} failed: ${getErrorMessage(error)}`,
        );
      }
    }
    return sent;
  }

  /** Settings › Notifications › Weekly report. */
  async setOn(userId: number, on: boolean): Promise<void> {
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, weeklyReport: on },
      update: { weeklyReport: on },
    });
  }

  private async send(userId: number, fitMin: number, now: Date): Promise<boolean> {
    const since = new Date(now.getTime() - WEEK_MS);
    const events = await this.prisma.applicationEvent.findMany({
      where: { userId, at: { gte: since } },
      select: { status: true },
    });
    await this.fits.ensureFresh(userId);
    const added = await this.prisma.userJob.findMany({
      where: { userId, addedAt: { gte: since } },
      select: {
        addedAt: true,
        job: {
          select: {
            id: true,
            title: true,
            company: { select: { name: true } },
            fits: { where: { userId }, select: { score: true } },
            hiddenBy: { where: { userId }, select: { userId: true } },
          },
        },
      },
    });
    const jobs = added.map(({ addedAt, job }) => ({
      addedAt,
      id: job.id,
      title: job.title,
      company: job.company.name,
      fit: job.fits[0]?.score ?? 0,
      // A job you hid is not a good one, even with a high Fit %.
      hidden: job.hiddenBy.length > 0,
    }));
    const isGood = (job: { fit: number; hidden: boolean }) => !job.hidden && job.fit >= fitMin;
    const good = jobs.filter(isGood).sort((a, b) => b.fit - a.fit);
    const counts: WeeklyCounts = {
      applied: events.filter((e) => e.status === ApplicationStatus.APPLIED).length,
      replies: events.filter((e) => REPLIES.includes(e.status)).length,
      interviews: events.filter((e) => e.status === ApplicationStatus.INTERVIEWING).length,
      newJobs: jobs.length,
      goodJobs: good.length,
    };
    if (!hasWeek(counts)) return false;

    const weeks = await this.searchWeeks(userId, since, jobs, isGood);
    const best = bestSearch(weeks);
    const pause = pauseSearch(weeks);
    const runAt = pause
      ? ((
          await this.prisma.savedSearch.findUnique({
            where: { id: pause.id },
            select: { runAt: true },
          })
        )?.runAt ?? null)
      : null;
    await this.notifications.push(userId, WEEKLY_REPORT, {
      searchName: '',
      count: counts.goodJobs,
      fitMin,
      jobs: good.slice(0, TOP_JOBS).map(({ id, title, company, fit }) => ({
        id,
        title,
        company,
        fit,
      })),
      weekly: {
        ...counts,
        best: best && {
          id: best.id,
          name: best.name,
          jobs: best.jobs,
          good: best.good,
          runAt: null,
        },
        pause: pause && { id: pause.id, name: pause.name, jobs: pause.jobs, good: 0, runAt },
      },
    });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { locale: true },
    });
    await this.push.send(userId, {
      ...weeklyText(counts, user.locale, best, pause),
      url: '/alerts',
    });
    return true;
  }

  /**
   * Each saved search's new jobs this week. A job belongs to the run that was going when it was
   * added to your list (the same way Autopilot finds a run's jobs).
   */
  private async searchWeeks(
    userId: number,
    since: Date,
    jobs: { addedAt: Date; fit: number; hidden: boolean }[],
    isGood: (job: { fit: number; hidden: boolean }) => boolean,
  ): Promise<SearchWeek[]> {
    const runs = await this.prisma.syncRun.findMany({
      where: { userId, savedSearchId: { not: null }, finishedAt: { gte: since } },
      select: {
        startedAt: true,
        finishedAt: true,
        savedSearch: { select: { id: true, name: true, schedule: true } },
      },
    });
    const weeks = new Map<number, SearchWeek>();
    for (const { savedSearch } of runs) {
      if (!savedSearch || weeks.has(savedSearch.id)) continue;
      weeks.set(savedSearch.id, {
        id: savedSearch.id,
        name: savedSearch.name,
        scheduled: savedSearch.schedule !== ScheduleFrequency.OFF,
        jobs: 0,
        good: 0,
      });
    }
    for (const job of jobs) {
      const run = runs.find((r) => r.startedAt <= job.addedAt && job.addedAt <= r.finishedAt);
      const week = run?.savedSearch ? weeks.get(run.savedSearch.id) : undefined;
      if (!week) continue;
      week.jobs += 1;
      if (isGood(job)) week.good += 1;
    }
    return [...weeks.values()];
  }
}
