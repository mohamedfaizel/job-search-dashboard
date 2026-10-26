import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getErrorMessage } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { SavedSearchesService } from './saved-searches.service';
import { nextRunAfter, startOfDay } from './schedule';

export interface ImportBudget {
  /** Credits used by every import since midnight (server time). */
  used: number;
  /** DAILY_CREDIT_CAP: scheduled runs stop before going over it. */
  cap: number;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/**
 * Runs saved searches on their schedule. Every minute it picks the searches whose
 * nextRunAt has passed and imports "only new" jobs for each, unless that could push
 * today's credits over DAILY_CREDIT_CAP.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly savedSearches: SavedSearchesService,
    private readonly config: ConfigService,
  ) {}

  get cap(): number {
    return Number(this.config.get<string>('DAILY_CREDIT_CAP') ?? 100);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    // Tests drive runDue() directly; a slow run must not overlap the next tick.
    if (this.config.get<string>('SCHEDULER_ENABLED') === 'false' || this.running) return;
    this.running = true;
    try {
      await this.runDue(new Date());
    } finally {
      this.running = false;
    }
  }

  async budget(now = new Date()): Promise<ImportBudget> {
    const { _sum } = await this.prisma.syncRun.aggregate({
      where: { finishedAt: { gte: startOfDay(now) } },
      _sum: { creditsCharged: true },
    });
    return { used: _sum.creditsCharged ?? 0, cap: this.cap };
  }

  /** Runs every search that is due at `now`. Returns how many it ran. */
  async runDue(now: Date): Promise<number> {
    const due = await this.prisma.savedSearch.findMany({
      where: { schedule: { not: 'OFF' }, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
    });

    let ran = 0;
    for (const search of due) {
      // Book the next time first, so a failure or a slow run can't make it fire twice.
      await this.prisma.savedSearch.update({
        where: { id: search.id },
        data: { nextRunAt: nextRunAfter(search.schedule, search.runAt, now) },
      });

      const { used, cap } = await this.budget(now);
      const mostItCanCost = search.pageSize * search.maxPages;
      if (used + mostItCanCost > cap) {
        await this.note(
          search.id,
          `Skipped at ${formatTime(now)}: it can use up to ${mostItCanCost} credits and ${used} of today's ${cap} are used.`,
        );
        continue;
      }

      try {
        const result = await this.savedSearches.run(search.id, false, { scheduled: true });
        await this.note(
          search.id,
          `Ran at ${formatTime(now)}: ${result.created} new, ${result.updated} already saved.`,
        );
        ran += 1;
      } catch (error) {
        this.logger.warn(`Scheduled run of "${search.name}" failed: ${getErrorMessage(error)}`);
        await this.note(search.id, `Failed at ${formatTime(now)}: ${getErrorMessage(error)}`);
      }
    }
    return ran;
  }

  private async note(id: number, scheduleNote: string): Promise<void> {
    await this.prisma.savedSearch.update({ where: { id }, data: { scheduleNote } });
  }
}
