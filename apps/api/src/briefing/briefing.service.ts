import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getErrorMessage } from '../common/errors';
import { ApplicationStatus, SuggestionState } from '../generated/prisma/enums';
import { FitService } from '../insights/fit.service';
import { isFollowUpDue } from '../jobs/follow-up';
import { NotificationsService, TOP_JOBS } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { BriefingCounts } from './briefing';
import { briefingText, hasNews, isBriefingDue } from './briefing';
import { PushService } from './push.service';

export const BRIEFING = 'BRIEFING';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The morning briefing: once a day at your time, one summary of what needs you (new good jobs,
 * kits ready, interviews today, follow-ups due, employer replies) in the bell and as a push on
 * your phone. Nothing new means no briefing.
 */
@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fits: FitService,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running || this.config.get<string>('SCHEDULER_ENABLED') === 'false') return;
    this.running = true;
    try {
      await this.sendDue(new Date());
    } finally {
      this.running = false;
    }
  }

  /** Sends every briefing due at `now`. Returns how many went out. */
  async sendDue(now: Date): Promise<number> {
    const profiles = await this.prisma.profile.findMany({
      where: { briefingOn: true },
      select: { userId: true, briefingAt: true, briefingSentAt: true, matchFitMin: true },
    });
    let sent = 0;
    for (const p of profiles) {
      if (!isBriefingDue(p.briefingAt, p.briefingSentAt, now)) continue;
      // Booked first, so a failure can't send it twice.
      await this.prisma.profile.update({
        where: { userId: p.userId },
        data: { briefingSentAt: now },
      });
      try {
        if (await this.send(p.userId, p.matchFitMin, p.briefingSentAt, now)) sent += 1;
      } catch (error) {
        this.logger.warn(`Briefing for user ${String(p.userId)} failed: ${getErrorMessage(error)}`);
      }
    }
    return sent;
  }

  /** Settings › Notifications › Morning briefing. */
  async setSettings(userId: number, on: boolean, at: string): Promise<void> {
    const data = { briefingOn: on, briefingAt: at };
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  private async send(
    userId: number,
    fitMin: number,
    lastSent: Date | null,
    now: Date,
  ): Promise<boolean> {
    const since = lastSent ?? new Date(now.getTime() - DAY_MS);
    await this.fits.ensureFresh(userId);
    const newGood = await this.prisma.jobFit.findMany({
      where: {
        userId,
        score: { gte: fitMin },
        job: {
          listedFor: { some: { userId, addedAt: { gte: since } } },
          hiddenBy: { none: { userId } },
        },
      },
      orderBy: { score: 'desc' },
      select: { score: true, job: { select: { id: true, title: true, company: true } } },
    });
    const kits = await this.prisma.applyQueueItem.count({
      where: {
        userId,
        job: {
          jobResumes: {
            some: { userId, OR: [{ coverLetter: { not: '' } }, { formAnswers: { not: '' } }] },
          },
        },
      },
    });
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const interviews = await this.prisma.application.count({
      where: { userId, interviewAt: { gte: now, lte: endOfDay } },
    });
    const applied = await this.prisma.application.findMany({
      where: { userId, status: ApplicationStatus.APPLIED },
      select: { status: true, statusChangedAt: true, followedUpAt: true },
    });
    const replies = await this.prisma.mailSuggestion.count({
      where: { userId, state: SuggestionState.PENDING },
    });
    const counts: BriefingCounts = {
      newJobs: newGood.length,
      kits,
      followUps: applied.filter((app) => isFollowUpDue(app, now)).length,
      interviews,
      replies,
    };
    if (!hasNews(counts)) return false;

    const jobs = newGood.slice(0, TOP_JOBS).map(({ score, job }) => ({
      id: job.id,
      title: job.title,
      company: job.company.name,
      fit: score,
    }));
    await this.notifications.push(userId, BRIEFING, {
      searchName: '',
      count: counts.newJobs,
      fitMin: fitMin,
      jobs,
      briefing: counts,
    });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { locale: true },
    });
    await this.push.send(userId, {
      ...briefingText(counts, user.locale, jobs[0]),
      url: '/alerts',
    });
    return true;
  }
}
