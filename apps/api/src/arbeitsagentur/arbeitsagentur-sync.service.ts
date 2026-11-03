import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { apiError } from '../common/api-error';
import { ImportSource } from '../generated/prisma/enums';
import { JobsService } from '../jobs/jobs.service';
import type { MappedJob } from '../jobspipe/jobspipe.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncJobsInput, SyncJobsResult } from '../sync/sync.input';
import { ArbeitsagenturClient } from './arbeitsagentur.client';
import { baExternalId, isUsable, mapArbeitsagenturJob } from './arbeitsagentur.mapper';
import type { BaDetail } from './arbeitsagentur.types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The board returns at most 100 listings a page. */
export const BA_MAX_PAGE_SIZE = 100;
/** Full ads are fetched this many at a time, to be kind to a free public service. */
const DETAIL_PARALLEL = 5;
const PAUSE_MS = 250;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** The search key of this source: an import with the same input resumes and dedups together. */
export function arbeitsagenturKey(input: SyncJobsInput): string {
  const norm = (list: string[] | undefined) =>
    [...new Set((list ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  return JSON.stringify({
    source: ImportSource.ARBEITSAGENTUR,
    titles: norm(input.titles),
    locations: norm(input.locations),
    ...(input.remoteOnly ? { remoteOnly: true } : {}),
    ...(norm(input.employmentTypes).length ? { employmentTypes: norm(input.employmentTypes) } : {}),
  });
}

/** The board's work-time filter from our job types: full-time, part-time and home office. */
export function workTimeFilter(input: SyncJobsInput): ('vz' | 'tz' | 'ho')[] {
  const types = input.employmentTypes ?? [];
  return [
    ...(types.includes('full-time') ? (['vz'] as const) : []),
    ...(types.includes('part-time') ? (['tz'] as const) : []),
    ...(input.remoteOnly ? (['ho'] as const) : []),
  ];
}

/**
 * Imports jobs from the Federal Employment Agency's job board. It has no credits, so a run costs
 * nothing; it only needs to be gentle. Jobs already saved are not fetched again.
 */
@Injectable()
export class ArbeitsagenturSyncService {
  private readonly logger = new Logger(ArbeitsagenturSyncService.name);

  constructor(
    private readonly client: ArbeitsagenturClient,
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  async sync(
    input: SyncJobsInput,
    options: { savedSearchId?: number; scheduled?: boolean } = {},
  ): Promise<SyncJobsResult> {
    const key = arbeitsagenturKey(input);
    const resuming = input.resume ? await this.resumePoint(key) : null;
    const startedAt = resuming?.startedAt ?? new Date();
    const newSince = resuming
      ? resuming.newSince
      : input.onlyNew
        ? await this.lastCompleteRunStart(key)
        : null;
    // With "only new", ask for the days since the last run (and one day more for the overlap).
    const days = newSince
      ? Math.min(
          input.maxAgeDays,
          Math.max(1, Math.ceil((Date.now() - newSince.getTime()) / DAY_MS) + 1),
        )
      : input.maxAgeDays;
    const size = Math.min(input.pageSize, BA_MAX_PAGE_SIZE);
    const what = input.titles.join(' ');
    const places = input.locations?.length ? input.locations : [undefined];
    const workTime = workTimeFilter(input);

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
      resumed: input.resume,
      warnings: [],
    };

    // One search per place (the board takes a single "where"); pages are counted across them.
    let page = resuming?.nextPage ?? 1;
    let placeIndex = resuming?.placeIndex ?? 0;
    let detailsFailed = 0;
    let more = false;
    while (placeIndex < places.length && result.pages < input.maxPages) {
      if (result.pages > 0) await wait(PAUSE_MS);
      const found = await this.client.search({
        what,
        where: places[placeIndex],
        days,
        page,
        size,
        ...(workTime.length ? { workTime } : {}),
      });
      const listings = (found.stellenangebote ?? []).filter(isUsable);
      const total = Number(found.maxErgebnisse ?? 0);
      result.pages += 1;
      result.fetched += listings.length;
      // Every page of a place repeats its total, so count it once.
      if (page === 1)
        result.totalAvailable = (result.totalAvailable ?? 0) + (Number.isFinite(total) ? total : 0);

      const skip = new Set(
        input.excludeTitles?.map((t) => t.trim().toLowerCase()).filter(Boolean) ?? [],
      );
      const wanted = listings.filter(
        (l) => ![...skip].some((word) => l.titel.toLowerCase().includes(word)),
      );
      const saved = await this.save(wanted);
      result.created += saved.created;
      result.updated += saved.updated;
      detailsFailed += saved.detailsFailed;

      const morePages = page * size < total && listings.length > 0;
      if (morePages) {
        page += 1;
      } else {
        placeIndex += 1;
        page = 1;
      }
      more = placeIndex < places.length;
    }
    result.hasMore = more;

    if (detailsFailed > 0) {
      this.logger.warn(
        `Could not read the full ad of ${detailsFailed} job(s); they were saved without a description`,
      );
    }

    await this.prisma.syncRun.create({
      data: {
        searchKey: key,
        input: {
          source: ImportSource.ARBEITSAGENTUR,
          titles: input.titles,
          skills: [],
          countryCodes: [],
          locations: input.locations ?? [],
          languages: [],
          skipFluentGerman: false,
          remoteOnly: input.remoteOnly,
          excludeTitles: input.excludeTitles ?? [],
          employmentTypes: input.employmentTypes ?? [],
          minSalaryEur: null,
          maxAgeDays: input.maxAgeDays,
          pageSize: input.pageSize,
          maxPages: input.maxPages,
          onlyNew: input.onlyNew,
          resume: input.resume,
        },
        startedAt,
        complete: !result.hasMore,
        fetched: result.fetched,
        created: result.created,
        updated: result.updated,
        creditsCharged: 0,
        jobsAlreadyPaid: 0,
        // Where "Continue" picks up: "<place number>:<page>".
        nextCursor: result.hasMore ? `${placeIndex}:${page}` : null,
        discoveredAtGte: newSince ? newSince.toISOString() : null,
        savedSearchId: options.savedSearchId ?? null,
        scheduled: options.scheduled ?? false,
      },
    });

    this.logger.log(
      `Arbeitsagentur: ${result.fetched} listings (${result.created} new, ${result.updated} already saved)`,
    );
    return result;
  }

  /** Saves the listings we don't have yet, with their full ad. */
  private async save(
    listings: Parameters<typeof mapArbeitsagenturJob>[0][],
  ): Promise<{ created: number; updated: number; detailsFailed: number }> {
    if (listings.length === 0) return { created: 0, updated: 0, detailsFailed: 0 };
    const known = await this.prisma.job.findMany({
      where: { externalId: { in: listings.map((l) => baExternalId(l.refnr)) } },
      select: { externalId: true },
    });
    const knownIds = new Set(known.map((job) => job.externalId));
    const fresh = listings.filter((l) => !knownIds.has(baExternalId(l.refnr)));

    let detailsFailed = 0;
    const mapped: MappedJob[] = [];
    for (let i = 0; i < fresh.length; i += DETAIL_PARALLEL) {
      const batch = fresh.slice(i, i + DETAIL_PARALLEL);
      const details = await Promise.all(
        batch.map((listing) =>
          this.client.detail(listing.refnr).catch((): BaDetail | null => {
            detailsFailed += 1;
            return null;
          }),
        ),
      );
      batch.forEach((listing, index) => {
        mapped.push(mapArbeitsagenturJob(listing, details[index] ?? null));
      });
      if (i + DETAIL_PARALLEL < fresh.length) await wait(PAUSE_MS);
    }
    await this.jobs.upsertMany(mapped);
    return { created: fresh.length, updated: listings.length - fresh.length, detailsFailed };
  }

  private async resumePoint(key: string) {
    const last = await this.prisma.syncRun.findFirst({
      where: { searchKey: key },
      orderBy: { id: 'desc' },
    });
    if (!last || last.complete || !last.nextCursor) {
      throw apiError(
        BadRequestException,
        'NOTHING_TO_CONTINUE',
        'Nothing to continue: the last import of this search already fetched every page.',
      );
    }
    const [place, page] = last.nextCursor.split(':').map(Number);
    return {
      startedAt: last.startedAt,
      newSince: last.discoveredAtGte ? new Date(last.discoveredAtGte) : null,
      placeIndex: place ?? 0,
      nextPage: page ?? 1,
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
