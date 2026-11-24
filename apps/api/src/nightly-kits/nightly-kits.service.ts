import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AI_PROVIDERS, AiCallError, completeWithKey } from '../api-keys/ai-providers';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { apiError } from '../common/api-error';
import { getErrorMessage } from '../common/errors';
import { InsightsService } from '../insights/insights.service';
import { NotificationsService, TOP_JOBS } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export const KITS_READY = 'KITS_READY';
export const KITS_FAILED = 'KITS_FAILED';

/** A whole kit (resume, cover letter, form answers, check) is long: room for all of it. */
const KIT_MAX_TOKENS = 12_000;
/** Writing that much takes a while; one job may take up to this long. */
const KIT_TIMEOUT_MS = 5 * 60 * 1000;
/** The prompt says this when there is no resume to tailor. */
const NO_RESUME = 'I have not added my resume here yet';

export interface KitRunResult {
  written: number;
  failed: number;
  /** Queued jobs still without a kit after this run. */
  waiting: number;
}

/** Why a run stopped before the end, in words the bell can show. Null when it did not stop. */
type StopReason = 'NO_KEY' | 'KEY_REFUSED' | 'NO_RESUME' | null;

/** Where a user's latest run is, so Settings can show it while it writes and when it is done. */
export interface KitRunStatus {
  running: boolean;
  /** Kits this run tries to write. */
  total: number;
  /** Jobs it has finished (written or failed). */
  done: number;
  written: number;
  failed: number;
  /** Why it stopped early or wrote none: NO_KEY, KEY_REFUSED, NO_RESUME, NONE_WRITTEN. */
  reason: string | null;
  startedAt: Date;
}

/**
 * Nightly apply kits: at night, for each user who turned it on in Settings, write the Apply kit
 * (resume, cover letter, form answers) of each queued job that has none yet, with the user's own
 * Claude or OpenAI key. It saves each reply as if pasted in the job's Apply tab, so the German
 * level cap and the usual checks apply. It never applies anywhere.
 */
@Injectable()
export class NightlyKitsService {
  private readonly logger = new Logger(NightlyKitsService.name);
  /** Users whose kits are being written now, so two runs never overlap. */
  private readonly running = new Set<number>();
  /** Each user's latest run since the server started. */
  private readonly runs = new Map<number, KitRunStatus>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    private readonly apiKeys: ApiKeysService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /** 03:00 server time: everyone who turned nightly kits on, one user after another. */
  @Cron('0 3 * * *')
  async nightly(): Promise<void> {
    if (this.config.get<string>('SCHEDULER_ENABLED') === 'false') return;
    const users = await this.prisma.profile.findMany({
      where: { nightlyKits: true },
      select: { userId: true, nightlyKitsMax: true },
    });
    for (const { userId, nightlyKitsMax } of users) {
      await this.run(userId, nightlyKitsMax);
    }
  }

  /** Settings: turn nightly kits on or off, and how many per night. */
  async setSettings(userId: number, on: boolean, perNight: number): Promise<void> {
    const data = { nightlyKits: on, nightlyKitsMax: perNight };
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  /**
   * "Write now": starts a run for this user and returns at once (it can take minutes); the bell
   * says when it is done. Refuses at once when there is no key or nothing to write.
   */
  async startNow(userId: number): Promise<number> {
    if (!(await this.keyFor(userId))) {
      throw apiError(BadRequestException, 'AI_KEY_MISSING', 'Save your AI key in Settings first');
    }
    const queue = await this.insights.applyQueue(userId);
    if (queue.length === 0) {
      throw apiError(BadRequestException, 'KITS_QUEUE_EMPTY', 'Your Apply queue is empty');
    }
    const waiting = queue.filter((item) => !item.ready);
    if (waiting.length === 0) {
      throw apiError(BadRequestException, 'KITS_NOTHING_TO_WRITE', 'Every queued job has a kit');
    }
    if (this.running.has(userId)) return waiting.length;
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { nightlyKitsMax: true },
    });
    const total = Math.min(waiting.length, profile?.nightlyKitsMax ?? 5);
    // Shown at once, before the run has read the queue again.
    this.runs.set(userId, { ...this.fresh(), total });
    void this.run(userId, profile?.nightlyKitsMax ?? 5);
    return total;
  }

  /** Your latest run (this one or the last finished), or null when there was none. */
  status(userId: number): KitRunStatus | null {
    return this.runs.get(userId) ?? null;
  }

  private fresh(): KitRunStatus {
    return {
      running: true,
      total: 0,
      done: 0,
      written: 0,
      failed: 0,
      reason: null,
      startedAt: new Date(),
    };
  }

  private track(userId: number, change: Partial<KitRunStatus>): void {
    const now = this.runs.get(userId) ?? this.fresh();
    this.runs.set(userId, { ...now, ...change });
  }

  /** Writes up to `max` kits for one user and tells them in the bell. Never throws. */
  async run(userId: number, max: number): Promise<KitRunResult | null> {
    if (this.running.has(userId)) return null;
    this.running.add(userId);
    this.runs.set(userId, { ...this.fresh(), total: this.runs.get(userId)?.total ?? 0 });
    try {
      return await this.write(userId, max);
    } catch (error) {
      this.logger.warn(`Nightly kits for user ${String(userId)} failed: ${getErrorMessage(error)}`);
      // Never silent: the bell and Settings say it did not work.
      this.track(userId, { reason: 'NONE_WRITTEN' });
      await this.failed(userId, 'NONE_WRITTEN').catch(() => undefined);
      return null;
    } finally {
      this.running.delete(userId);
      this.track(userId, { running: false });
    }
  }

  private async write(userId: number, max: number): Promise<KitRunResult | null> {
    const waiting = await this.waitingJobs(userId);
    const total = Math.min(waiting.length, Math.max(0, max));
    this.track(userId, { total });
    if (waiting.length === 0) return null;
    const key = await this.keyFor(userId);
    if (!key) {
      this.track(userId, { reason: 'NO_KEY' });
      await this.failed(userId, 'NO_KEY');
      return null;
    }

    const written: { jobId: string; title: string; company: string }[] = [];
    let failed = 0;
    let stop: StopReason = null;
    for (const job of waiting.slice(0, Math.max(0, max))) {
      try {
        const { prompt } = await this.insights.forJob(userId, job.jobId);
        if (prompt.includes(NO_RESUME)) {
          stop = 'NO_RESUME';
          break;
        }
        const reply = await completeWithKey(key.provider, key.key, key.model, prompt, {
          maxTokens: KIT_MAX_TOKENS,
          timeoutMs: KIT_TIMEOUT_MS,
        });
        await this.insights.saveJobResume(userId, job.jobId, reply);
        written.push(job);
        this.track(userId, { done: written.length + failed, written: written.length });
      } catch (error) {
        if (error instanceof AiCallError && error.cause === 'KEY_REFUSED') {
          stop = 'KEY_REFUSED';
          break;
        }
        failed += 1;
        this.track(userId, { done: written.length + failed, failed });
        this.logger.warn(
          `Kit for ${String(userId)}:${job.jobId} failed: ${getErrorMessage(error)}`,
        );
      }
    }

    this.track(userId, {
      reason: written.length === 0 ? (stop ?? 'NONE_WRITTEN') : stop,
    });
    if (written.length === 0) {
      await this.failed(userId, stop ?? 'NONE_WRITTEN', failed);
    } else {
      const fits = await this.prisma.jobFit.findMany({
        where: { userId, jobId: { in: written.map((job) => job.jobId) } },
        select: { jobId: true, score: true },
      });
      const fitOf = new Map(fits.map((row) => [row.jobId, row.score]));
      await this.notifications.push(userId, KITS_READY, {
        searchName: '',
        count: written.length,
        fitMin: 0,
        jobs: written.slice(0, TOP_JOBS).map((job) => ({
          id: job.jobId,
          title: job.title,
          company: job.company,
          fit: fitOf.get(job.jobId) ?? 0,
        })),
        failed,
        ...(stop ? { reason: stop } : {}),
      });
    }
    return {
      written: written.length,
      failed,
      waiting: waiting.length - written.length,
    };
  }

  /** Queued jobs with no kit yet, in queue order. */
  private async waitingJobs(userId: number) {
    return (await this.insights.applyQueue(userId)).filter((item) => !item.ready);
  }

  /** The user's chosen AI provider with its saved key and model, or null without a key. */
  private async keyFor(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { aiProvider: true },
    });
    const provider = AI_PROVIDERS[user.aiProvider];
    const saved = await this.apiKeys.aiKey(userId, provider.kind);
    if (!saved) return null;
    return {
      provider: user.aiProvider,
      key: saved.key,
      model: saved.model ?? provider.defaultModel,
    };
  }

  private async failed(userId: number, reason: string, failed = 0): Promise<void> {
    await this.notifications.push(userId, KITS_FAILED, {
      searchName: '',
      count: 0,
      fitMin: 0,
      jobs: [],
      failed,
      reason,
    });
  }
}
