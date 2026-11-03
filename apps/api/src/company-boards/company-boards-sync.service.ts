import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { apiError } from '../common/api-error';
import { ImportSource } from '../generated/prisma/enums';
import { JobsService } from '../jobs/jobs.service';
import type { MappedJob } from '../jobspipe/jobspipe.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncJobsInput, SyncJobsResult } from '../sync/sync.input';
import { boardKey, parseBoard } from './board-ref';
import { CompanyBoardsClient } from './company-boards.client';
import { fitsSearch, mapBoardPosting } from './company-boards.mapper';
import type { BoardRef } from './company-boards.types';

const PAUSE_MS = 250;
/** A run saves at most this many postings, however wide the search. */
export const MAX_SAVED_PER_RUN = 500;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** The boards named in the input. A name we can't read is the person's mistake, so say which. */
export function boardsOf(input: SyncJobsInput): BoardRef[] {
  const boards = new Map<string, BoardRef>();
  for (const entry of input.boards ?? []) {
    const board = parseBoard(entry);
    if (!board) {
      throw apiError(
        BadRequestException,
        'INVALID_BOARD',
        `Could not read the company board "${entry}". Use greenhouse:name, lever:name or ashby:name, or paste the career page address.`,
        { entry },
      );
    }
    boards.set(boardKey(board), board);
  }
  if (boards.size === 0) {
    throw apiError(
      BadRequestException,
      'NO_BOARDS',
      'Add at least one company board, e.g. greenhouse:stripe.',
    );
  }
  return [...boards.values()];
}

/** The search key of this source: an import with the same input dedups its history together. */
export function companyBoardsKey(input: SyncJobsInput, boards: BoardRef[]): string {
  const norm = (list: string[] | undefined) =>
    [...new Set((list ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  return JSON.stringify({
    source: ImportSource.COMPANY_BOARDS,
    boards: boards.map(boardKey).sort((a, b) => a.localeCompare(b)),
    titles: norm(input.titles),
    locations: norm(input.locations),
    ...(input.remoteOnly ? { remoteOnly: true } : {}),
    ...(norm(input.employmentTypes).length ? { employmentTypes: norm(input.employmentTypes) } : {}),
  });
}

/**
 * Imports jobs straight from companies' career pages (Greenhouse, Lever, Ashby). No credits.
 * Each board is read whole and filtered here, since the feeds can't be searched.
 */
@Injectable()
export class CompanyBoardsSyncService {
  private readonly logger = new Logger(CompanyBoardsSyncService.name);

  constructor(
    private readonly client: CompanyBoardsClient,
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  async sync(
    input: SyncJobsInput,
    options: { savedSearchId?: number; scheduled?: boolean } = {},
  ): Promise<SyncJobsResult> {
    if (input.resume) {
      throw apiError(
        BadRequestException,
        'NOTHING_TO_CONTINUE',
        'Nothing to continue: a company board import always reads every posting.',
      );
    }
    const boards = boardsOf(input);
    const startedAt = new Date();
    const warnings: string[] = [];
    const mapped: MappedJob[] = [];
    let seen = 0;

    for (const [index, board] of boards.entries()) {
      if (index > 0) await wait(PAUSE_MS);
      try {
        const postings = await this.client.postings(board);
        seen += postings.length;
        for (const posting of postings) {
          if (fitsSearch(posting, input, startedAt))
            mapped.push(mapBoardPosting(board, posting, startedAt));
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        warnings.push(`${boardKey(board)}: ${reason}`);
        this.logger.warn(`Could not read ${boardKey(board)}: ${reason}`);
      }
    }

    // Newest first, so a run that hits the cap keeps the freshest.
    mapped.sort((a, b) => Number(b.job.postedAt) - Number(a.job.postedAt));
    const cut = mapped.slice(0, MAX_SAVED_PER_RUN);
    if (mapped.length > cut.length) {
      warnings.push(
        `${mapped.length} postings fit; only the newest ${MAX_SAVED_PER_RUN} were saved. Narrow the job title or places.`,
      );
    }
    const saved = await this.jobs.upsertMany(cut);

    await this.prisma.syncRun.create({
      data: {
        searchKey: companyBoardsKey(input, boards),
        input: {
          source: ImportSource.COMPANY_BOARDS,
          boards: boards.map(boardKey),
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
          resume: false,
        },
        startedAt,
        complete: true,
        fetched: cut.length,
        created: saved.created,
        updated: saved.updated,
        creditsCharged: 0,
        jobsAlreadyPaid: 0,
        nextCursor: null,
        discoveredAtGte: null,
        savedSearchId: options.savedSearchId ?? null,
        scheduled: options.scheduled ?? false,
      },
    });

    this.logger.log(
      `Company boards: ${seen} postings on ${boards.length} board(s), ${cut.length} fit (${saved.created} new)`,
    );
    return {
      pages: boards.length,
      fetched: cut.length,
      created: saved.created,
      updated: saved.updated,
      totalAvailable: null,
      hasMore: false,
      creditsRemaining: null,
      creditsCharged: 0,
      jobsAlreadyPaid: 0,
      newSince: null,
      resumed: false,
      warnings,
    };
  }
}
