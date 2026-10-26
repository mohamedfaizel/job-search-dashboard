import { Injectable, Logger } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { JobsPipeClient } from '../jobspipe/jobspipe.client';
import { mapJobsPipeJob } from '../jobspipe/jobspipe.mapper';
import type { JobsPipeSearchRequest } from '../jobspipe/jobspipe.types';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncJobsInput, SyncJobsResult } from './sync.input';

/**
 * Start an incremental run this long before the previous one started, so a posting
 * JobsPipe indexed while that run was in progress is not missed. The overlap is free:
 * JobsPipe doesn't charge twice for a job in the same month, and the upsert skips it.
 */
const OVERLAP_MS = 60 * 60 * 1000;

/** The same search always gets the same key, whatever the order or case of its terms. */
export function searchKey(input: SyncJobsInput): string {
  const norm = (list: string[] | undefined) =>
    [...new Set((list ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean))].sort();
  return JSON.stringify({
    titles: norm(input.titles),
    skills: norm(input.skills),
    countries: norm(input.countryCodes),
  });
}

/** JobsPipe's date-time format: "2026-10-26 14:05:00" in UTC. */
export function toJobsPipeTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** Pulls postings from JobsPipe page by page and saves them. */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly jobsPipe: JobsPipeClient,
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  async sync(input: SyncJobsInput): Promise<SyncJobsResult> {
    const startedAt = new Date();
    const key = searchKey(input);
    const newSince = input.onlyNew ? await this.lastCompleteRunStart(key) : null;

    const result: SyncJobsResult = {
      pages: 0,
      fetched: 0,
      created: 0,
      updated: 0,
      totalAvailable: null,
      hasMore: false,
      creditsRemaining: null,
      creditsCharged: 0,
      jobsAlreadyPaid: 0,
      newSince,
    };

    let cursor: string | null = null;
    do {
      const body: JobsPipeSearchRequest = {
        job_title_or: input.titles,
        posted_at_max_age_days: input.maxAgeDays,
        limit: input.pageSize,
        include_total_results: result.pages === 0,
        ...(input.skills?.length ? { skills_or: input.skills } : {}),
        ...(input.countryCodes?.length
          ? { job_country_code_or: input.countryCodes.map((c) => c.toUpperCase()) }
          : {}),
        ...(newSince
          ? { discovered_at_gte: toJobsPipeTime(new Date(newSince.getTime() - OVERLAP_MS)) }
          : {}),
        ...(cursor ? { cursor } : {}),
      };
      const page = await this.jobsPipe.searchJobs(body);

      const saved = await this.jobs.upsertMany(page.data.map(mapJobsPipeJob));
      result.pages += 1;
      result.fetched += page.data.length;
      result.created += saved.created;
      result.updated += saved.updated;
      result.totalAvailable ??= page.metadata.total_results;
      result.creditsRemaining = page.metadata.credits_remaining;
      result.creditsCharged += page.metadata.credits_charged;
      result.jobsAlreadyPaid += page.metadata.jobs_already_paid;
      cursor = page.metadata.next_cursor;
    } while (cursor && result.pages < input.maxPages);

    result.hasMore = cursor !== null;

    // Remember the run. Only a complete one (no pages left unfetched) moves the starting
    // point forward, so jobs beyond maxPages are picked up next time.
    await this.prisma.syncRun.create({
      data: {
        searchKey: key,
        input: {
          titles: input.titles,
          skills: input.skills ?? [],
          countryCodes: input.countryCodes ?? [],
          maxAgeDays: input.maxAgeDays,
          pageSize: input.pageSize,
          maxPages: input.maxPages,
          onlyNew: input.onlyNew,
        },
        startedAt,
        complete: !result.hasMore,
        fetched: result.fetched,
        created: result.created,
        updated: result.updated,
        creditsCharged: result.creditsCharged,
        jobsAlreadyPaid: result.jobsAlreadyPaid,
      },
    });

    this.logger.log(
      `Synced ${result.fetched} jobs (${result.created} new, ${result.updated} already saved) in ${result.pages} page(s)`,
    );
    return result;
  }

  private async lastCompleteRunStart(key: string): Promise<Date | null> {
    const run = await this.prisma.syncRun.findFirst({
      where: { searchKey: key, complete: true },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    return run?.startedAt ?? null;
  }
}
