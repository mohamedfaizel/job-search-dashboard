import { Injectable, Logger } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { JobsPipeClient } from '../jobspipe/jobspipe.client';
import { mapJobsPipeJob } from '../jobspipe/jobspipe.mapper';
import type { JobsPipeSearchRequest } from '../jobspipe/jobspipe.types';
import type { SyncJobsInput, SyncJobsResult } from './sync.input';

/** Pulls postings from JobsPipe page by page and saves them. */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly jobsPipe: JobsPipeClient,
    private readonly jobs: JobsService,
  ) {}

  async sync(input: SyncJobsInput): Promise<SyncJobsResult> {
    const result: SyncJobsResult = {
      pages: 0,
      fetched: 0,
      created: 0,
      updated: 0,
      totalAvailable: null,
      hasMore: false,
      creditsRemaining: null,
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
      cursor = page.metadata.next_cursor;
    } while (cursor && result.pages < input.maxPages);

    result.hasMore = cursor !== null;
    this.logger.log(
      `Synced ${result.fetched} jobs (${result.created} new, ${result.updated} updated) in ${result.pages} page(s)`,
    );
    return result;
  }
}
