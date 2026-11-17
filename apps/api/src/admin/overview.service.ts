import { Injectable } from '@nestjs/common';
import { PdfRendererClient } from '../documents/pdf-renderer.client';
import { GmailClient } from '../gmail/gmail.client';
import { PrismaService } from '../prisma/prisma.service';
import { ResumeMatcherClient } from '../resume-matcher/resume-matcher.client';
import { startOfDay } from '../saved-searches/schedule';
import { SettingsService } from '../settings/settings.service';
import type { AdminOverviewModel, HealthCheckModel } from './overview.model';
import { HealthService, HealthState } from './overview.model';

const DAY_MS = 24 * 60 * 60 * 1000;

const check = (
  service: HealthService,
  state: HealthState,
  extra: Partial<HealthCheckModel> = {},
): HealthCheckModel => ({ service, state, offInEnv: false, nextRunAt: null, ...extra });

/**
 * Admin › Overview: how many people use the app, imports this week, and whether the parts of
 * the server are running. Counts only: nobody's jobs, resumes or keys.
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly pdf: PdfRendererClient,
    private readonly matcher: ResumeMatcherClient,
    private readonly gmail: GmailClient,
  ) {}

  async overview(now = new Date()): Promise<AdminOverviewModel> {
    const today = startOfDay(now);
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    // Six days back plus today; each day is a calendar day in server time.
    const firstDay = new Date(today);
    firstDay.setDate(firstDay.getDate() - 6);

    const [users, newThisWeek, activeThisWeek, keys, runs, health] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gte: weekAgo } } }),
      this.prisma.apiKey.findMany({
        where: { kind: 'JOBHUNTER' },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.syncRun.findMany({
        where: { finishedAt: { gte: firstDay } },
        select: { finishedAt: true, created: true },
      }),
      this.health(),
    ]);

    const week = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(firstDay);
      day.setDate(day.getDate() + i);
      return { day, imports: 0 };
    });
    let importsToday = 0;
    let jobsAddedToday = 0;
    for (const run of runs) {
      const day = startOfDay(run.finishedAt).getTime();
      const slot = week.find((d) => d.day.getTime() === day);
      if (slot) slot.imports += 1;
      if (day === today.getTime()) {
        importsToday += 1;
        jobsAddedToday += run.created;
      }
    }

    return {
      users,
      newThisWeek,
      activeThisWeek,
      withJobKey: keys.length,
      importsToday,
      jobsAddedToday,
      week,
      health,
    };
  }

  /** Each part of the server, checked now. Never throws: a part that fails is DOWN. */
  async health(): Promise<HealthCheckModel[]> {
    const [database, pdf, matcher, scheduler, stillOpen] = await Promise.all([
      this.database(),
      this.pdfMaker(),
      this.resumeMatcher(),
      this.scheduler(),
      this.stillOpen(),
    ]);
    const gmail = this.gmail.configured
      ? check(HealthService.GMAIL, HealthState.OK)
      : check(HealthService.GMAIL, HealthState.OFF, { offInEnv: true });
    return [database, pdf, matcher, gmail, scheduler, stillOpen];
  }

  private async database(): Promise<HealthCheckModel> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return check(HealthService.DATABASE, HealthState.OK);
    } catch {
      return check(HealthService.DATABASE, HealthState.DOWN);
    }
  }

  private async pdfMaker(): Promise<HealthCheckModel> {
    if (!this.pdf.isConfigured) {
      return check(HealthService.PDF_MAKER, HealthState.OFF, { offInEnv: true });
    }
    return check(
      HealthService.PDF_MAKER,
      (await this.pdf.isReachable()) ? HealthState.OK : HealthState.DOWN,
    );
  }

  private async resumeMatcher(): Promise<HealthCheckModel> {
    if (!this.matcher.isConfigured) {
      return check(HealthService.RESUME_MATCHER, HealthState.OFF, { offInEnv: true });
    }
    try {
      await this.matcher.health();
      return check(HealthService.RESUME_MATCHER, HealthState.OK);
    } catch {
      return check(HealthService.RESUME_MATCHER, HealthState.DOWN);
    }
  }

  private async scheduler(): Promise<HealthCheckModel> {
    if (!(await this.settings.schedulerOn())) {
      return check(HealthService.SCHEDULER, HealthState.OFF, {
        offInEnv: this.settings.schedulerOffInEnv,
      });
    }
    const next = await this.prisma.savedSearch.findFirst({
      where: { schedule: { not: 'OFF' }, nextRunAt: { not: null } },
      orderBy: { nextRunAt: 'asc' },
      select: { nextRunAt: true },
    });
    return check(HealthService.SCHEDULER, HealthState.OK, { nextRunAt: next?.nextRunAt ?? null });
  }

  private async stillOpen(): Promise<HealthCheckModel> {
    return (await this.settings.stillOpenOn())
      ? check(HealthService.STILL_OPEN, HealthState.OK)
      : check(HealthService.STILL_OPEN, HealthState.OFF, {
          offInEnv: this.settings.stillOpenOffInEnv,
        });
  }
}
