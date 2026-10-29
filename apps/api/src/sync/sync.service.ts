import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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

/**
 * Phrases a German ad uses when it needs fluent German. JobsPipe matches every word of a phrase,
 * in any order, so each one names Deutschkenntnisse itself to avoid skipping English ads.
 */
export const FLUENT_GERMAN_PHRASES = [
  'fließende Deutschkenntnisse',
  'fließenden Deutschkenntnissen',
  'fliessende Deutschkenntnisse',
  'verhandlungssichere Deutschkenntnisse',
  'verhandlungssicheren Deutschkenntnissen',
  'sehr gute Deutschkenntnisse',
  'sehr guten Deutschkenntnissen',
  'Deutschkenntnisse C1',
  'Deutschkenntnisse C2',
];

/**
 * JobsPipe's salary filter is in US dollars. A rough rate is enough for a minimum; update it if
 * the euro moves a lot.
 */
export const EUR_TO_USD = 1.08;

/** The same search always gets the same key, whatever the order or case of its terms. */
export function searchKey(input: SyncJobsInput): string {
  const norm = (list: string[] | undefined) =>
    [...new Set((list ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean))].sort();
  const locations = norm(input.locations);
  const languages = norm(input.languages);
  const excludeTitles = norm(input.excludeTitles);
  const employmentTypes = norm(input.employmentTypes);
  // Each filter goes in only when set, so searches from before it existed keep their key.
  return JSON.stringify({
    titles: norm(input.titles),
    skills: norm(input.skills),
    countries: norm(input.countryCodes),
    ...(locations.length ? { locations } : {}),
    ...(languages.length ? { languages } : {}),
    ...(input.skipFluentGerman ? { skipFluentGerman: true } : {}),
    ...(input.remoteOnly ? { remoteOnly: true } : {}),
    ...(excludeTitles.length ? { excludeTitles } : {}),
    ...(employmentTypes.length ? { employmentTypes } : {}),
    ...(input.minSalaryEur ? { minSalaryEur: input.minSalaryEur } : {}),
  });
}

/** JobsPipe's date-time format: "2026-10-26 14:05:00" in UTC. */
export function toJobsPipeTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** The search filters, without paging. Every page of a run sends the same ones. */
function toFilters(input: SyncJobsInput, discoveredAtGte: string | null): JobsPipeSearchRequest {
  const unknown = [
    ...(input.languages?.length ? ['language'] : []),
    ...(input.employmentTypes?.length ? ['employment_type'] : []),
  ];
  return {
    job_title_or: input.titles,
    posted_at_max_age_days: input.maxAgeDays,
    ...(input.skills?.length ? { skills_or: input.skills } : {}),
    ...(input.countryCodes?.length
      ? { job_country_code_or: input.countryCodes.map((c) => c.toUpperCase()) }
      : {}),
    ...(input.locations?.length ? { job_location_or: input.locations } : {}),
    ...(input.languages?.length
      ? { language_or: input.languages.map((l) => l.toLowerCase()) }
      : {}),
    ...(input.skipFluentGerman ? { description_not: FLUENT_GERMAN_PHRASES } : {}),
    ...(input.remoteOnly ? { remote: true } : {}),
    ...(input.excludeTitles?.length ? { job_title_not: input.excludeTitles } : {}),
    ...(input.employmentTypes?.length ? { employment_type_or: input.employmentTypes } : {}),
    ...(input.minSalaryEur ? { min_salary_usd: Math.round(input.minSalaryEur * EUR_TO_USD) } : {}),
    // Most postings have no language or job type yet; dropping them all would hide good jobs.
    ...(unknown.length ? { include_unknown: unknown } : {}),
    ...(discoveredAtGte ? { discovered_at_gte: discoveredAtGte } : {}),
    // Newest first is the only order JobsPipe supports; it keeps the cursor stable.
    order_by: [{ field: 'posted_at', desc: true }],
  };
}

/** Where a run starts: a fresh search, an "only new" window, or an earlier run's cursor. */
interface StartPoint {
  startedAt: Date;
  newSince: Date | null;
  discoveredAtGte: string | null;
  cursor: string | null;
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

  async sync(
    input: SyncJobsInput,
    options: { savedSearchId?: number; scheduled?: boolean } = {},
  ): Promise<SyncJobsResult> {
    const key = searchKey(input);
    const start = input.resume ? await this.resumePoint(key) : await this.freshStart(key, input);

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
      newSince: start.newSince,
      resumed: input.resume,
    };

    const filters = toFilters(input, start.discoveredAtGte);
    let cursor = start.cursor;
    do {
      const page = await this.jobsPipe.searchJobs({
        ...filters,
        limit: input.pageSize,
        include_total_results: result.pages === 0,
        ...(cursor ? { cursor } : {}),
      });

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

    // Remember the run. Only a complete one (no pages left unfetched) moves the "only new"
    // starting point forward; an incomplete one keeps its cursor so it can be continued.
    await this.prisma.syncRun.create({
      data: {
        searchKey: key,
        input: {
          titles: input.titles,
          skills: input.skills ?? [],
          countryCodes: input.countryCodes ?? [],
          locations: input.locations ?? [],
          languages: input.languages ?? [],
          skipFluentGerman: input.skipFluentGerman,
          remoteOnly: input.remoteOnly,
          excludeTitles: input.excludeTitles ?? [],
          employmentTypes: input.employmentTypes ?? [],
          minSalaryEur: input.minSalaryEur ?? null,
          maxAgeDays: input.maxAgeDays,
          pageSize: input.pageSize,
          maxPages: input.maxPages,
          onlyNew: input.onlyNew,
          resume: input.resume,
        },
        // A continued run belongs to the window of the run it continues.
        startedAt: start.startedAt,
        complete: !result.hasMore,
        fetched: result.fetched,
        created: result.created,
        updated: result.updated,
        creditsCharged: result.creditsCharged,
        jobsAlreadyPaid: result.jobsAlreadyPaid,
        nextCursor: cursor,
        discoveredAtGte: start.discoveredAtGte,
        savedSearchId: options.savedSearchId ?? null,
        scheduled: options.scheduled ?? false,
      },
    });

    this.logger.log(
      `Synced ${result.fetched} jobs (${result.created} new, ${result.updated} already saved) in ${result.pages} page(s)`,
    );
    return result;
  }

  private async freshStart(key: string, input: SyncJobsInput): Promise<StartPoint> {
    const newSince = input.onlyNew ? await this.lastCompleteRunStart(key) : null;
    return {
      startedAt: new Date(),
      newSince,
      discoveredAtGte: newSince ? toJobsPipeTime(new Date(newSince.getTime() - OVERLAP_MS)) : null,
      cursor: null,
    };
  }

  private async resumePoint(key: string): Promise<StartPoint> {
    const last = await this.prisma.syncRun.findFirst({
      where: { searchKey: key },
      orderBy: { id: 'desc' },
    });
    if (!last || last.complete || !last.nextCursor) {
      throw new BadRequestException(
        'Nothing to continue: the last import of this search already fetched every page.',
      );
    }
    return {
      startedAt: last.startedAt,
      newSince: last.discoveredAtGte
        ? new Date(`${last.discoveredAtGte.replace(' ', 'T')}Z`)
        : null,
      discoveredAtGte: last.discoveredAtGte,
      cursor: last.nextCursor,
    };
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
