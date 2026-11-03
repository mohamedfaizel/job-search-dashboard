import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { apiError } from '../common/api-error';
import { ApplicationStatus, PostingCheck } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { Verdict } from './judge';
import { judge } from './judge';
import { PageFetcher } from './page-fetcher';
import { UnsafeUrlError } from './safe-fetch';

/** A job checked this recently isn't fetched again when you press "Check now". */
export const RECHECK_AFTER_MS = 10 * 60 * 1000;
/** The nightly run skips jobs checked within this long (a manual check, or last night). */
const NIGHTLY_SKIP_MS = 20 * 60 * 60 * 1000;
/** How many links the nightly run opens at the same time. Small, to be polite to job sites. */
const PARALLEL = 4;

/** Statuses where you still might apply, so the check matters most. */
const STILL_DECIDING: ApplicationStatus[] = [ApplicationStatus.SAVED];

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * "Is this job still open?" Opens the job's link, reads the page, and marks the job "expired"
 * when it is clearly closed. Runs when you ask (popup, Apply tab) and every night.
 */
@Injectable()
export class LivenessService {
  private readonly logger = new Logger(LivenessService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: PageFetcher,
    private readonly config: ConfigService,
  ) {}

  private get timeoutMs(): number {
    return Number(this.config.get<string>('STILL_OPEN_TIMEOUT_MS') ?? 15_000);
  }

  /** STILL_OPEN_NIGHTLY_LIMIT: the most jobs one nightly run checks. */
  get nightlyLimit(): number {
    return Number(this.config.get<string>('STILL_OPEN_NIGHTLY_LIMIT') ?? 300);
  }

  /** Opens one job's link and saves what it found. Returns the verdict. */
  async check(jobId: string, now = new Date()): Promise<Verdict> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { url: true, checkedAt: true, lastCheck: true, checkReason: true },
    });
    if (!job)
      throw apiError(NotFoundException, 'JOB_NOT_FOUND', `Job ${jobId} not found`, { id: jobId });

    // Pressing the button twice, or opening the Apply tab again, doesn't hit the site again.
    if (
      job.checkedAt &&
      job.lastCheck &&
      now.getTime() - job.checkedAt.getTime() < RECHECK_AFTER_MS
    ) {
      return {
        result: job.lastCheck,
        reason: (job.checkReason ?? 'LOOKS_OPEN') as Verdict['reason'],
      };
    }

    const verdict = job.url
      ? await this.open(job.url)
      : ({ result: 'UNKNOWN', reason: 'NO_LINK' } as const);
    await this.record(jobId, verdict, now);
    return verdict;
  }

  /** Fetches and judges a link. Network trouble is UNKNOWN, never CLOSED. */
  async open(url: string): Promise<Verdict> {
    try {
      return judge(await this.fetcher.get(url, this.timeoutMs));
    } catch (error) {
      if (error instanceof UnsafeUrlError) return { result: 'UNKNOWN', reason: 'NO_LINK' };
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError')
        return { result: 'UNKNOWN', reason: 'TIMEOUT' };
      return { result: 'UNKNOWN', reason: 'UNREACHABLE' };
    }
  }

  /** Saves a verdict. CLOSED expires the job; OPEN brings back one we wrongly expired. */
  async record(jobId: string, verdict: Verdict, now: Date): Promise<void> {
    const job = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      select: { postingStatus: true, expiredAt: true },
    });
    const status =
      verdict.result === 'CLOSED'
        ? { postingStatus: 'expired', expiredAt: job.expiredAt ?? now }
        : verdict.result === 'OPEN' && job.postingStatus === 'expired'
          ? { postingStatus: 'active', expiredAt: null }
          : {};
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        checkedAt: now,
        lastCheck: PostingCheck[verdict.result],
        checkReason: verdict.reason,
        ...status,
      },
    });
  }

  // Every night at 03:00 server time, when nobody is waiting for it.
  @Cron('0 3 * * *')
  async nightly(): Promise<void> {
    if (this.config.get<string>('STILL_OPEN_CHECK_ENABLED') === 'false' || this.running) return;
    this.running = true;
    try {
      const counts = await this.checkDue(new Date());
      this.logger.log(
        `Still-open check: ${counts.checked} jobs, ${counts.closed} expired, ${counts.unknown} unclear`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * The nightly run. Checks jobs that are still open, have a link, and weren't checked today:
   * first the ones someone saved or queued (you might apply), then the newest.
   */
  async checkDue(
    now: Date,
    limit = this.nightlyLimit,
    pauseMs = 500,
  ): Promise<{ checked: number; closed: number; unknown: number }> {
    const base = {
      url: { not: null },
      postingStatus: { notIn: ['expired', 'closed'] },
      OR: [{ checkedAt: null }, { checkedAt: { lt: new Date(now.getTime() - NIGHTLY_SKIP_MS) } }],
    };
    const wanted = await this.prisma.job.findMany({
      where: {
        ...base,
        AND: {
          OR: [
            { applications: { some: { status: { in: STILL_DECIDING } } } },
            { applyQueue: { some: {} } },
          ],
        },
      },
      select: { id: true },
      orderBy: { postedAt: 'desc' },
      take: limit,
    });
    const rest =
      wanted.length < limit
        ? await this.prisma.job.findMany({
            where: { ...base, id: { notIn: wanted.map((job) => job.id) } },
            select: { id: true },
            orderBy: { postedAt: 'desc' },
            take: limit - wanted.length,
          })
        : [];
    const ids = [...wanted, ...rest].map((job) => job.id);

    const counts = { checked: 0, closed: 0, unknown: 0 };
    for (let i = 0; i < ids.length; i += PARALLEL) {
      const verdicts = await Promise.all(
        ids.slice(i, i + PARALLEL).map((id) => this.check(id, now)),
      );
      for (const verdict of verdicts) {
        counts.checked += 1;
        if (verdict.result === 'CLOSED') counts.closed += 1;
        if (verdict.result === 'UNKNOWN') counts.unknown += 1;
      }
      if (pauseMs > 0 && i + PARALLEL < ids.length) await wait(pauseMs);
    }
    return counts;
  }
}
