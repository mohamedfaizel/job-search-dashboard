import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error';
import type { Prisma, SavedSearch as SavedSearchRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ImportSource } from '../sync/import-source';
import type { SyncJobsInput, SyncJobsResult } from '../sync/sync.input';
import { SyncService } from '../sync/sync.service';
import type {
  AutopilotInput,
  SavedSearch,
  SavedSearchInput,
  SyncRunModel,
} from './saved-search.model';
import type { ScheduleFrequency } from './schedule';
import { nextRunAfter } from './schedule';

type RunRow = Prisma.SyncRunGetPayload<{ include: { savedSearch: { select: { name: true } } } }>;

const withSearchName = { savedSearch: { select: { name: true } } } satisfies Prisma.SyncRunInclude;

/** "en" → "English", for the search summary. */
function languageName(code: string): string {
  return (
    ({ en: 'English', de: 'German' } as Record<string, string | undefined>)[code] ??
    code.toUpperCase()
  );
}

/** One list field of the input an import stored, or none. */
function listOf(input: Prisma.JsonValue, key: string): string[] {
  const obj = (input ?? {}) as Record<string, unknown>;
  return Array.isArray(obj[key]) ? (obj[key] as string[]) : [];
}

/** Where a stored import looked. JobHunter runs stored no source. */
function sourceOf(input: Prisma.JsonValue): ImportSource {
  const value = ((input ?? {}) as Record<string, unknown>)['source'];
  return Object.values(ImportSource).includes(value as ImportSource)
    ? (value as ImportSource)
    : ImportSource.JOBHUNTER;
}

/**
 * "frontend, react dev · DE · Berlin" from the input an import stored. The company boards are
 * left out: a run can have 90 of them, so the history lists them apart (see `boards`).
 */
function summarize(input: Prisma.JsonValue): string {
  const obj = (input ?? {}) as Record<string, unknown>;
  const list = (key: string) => listOf(input, key);
  const extras = [
    list('languages').length ? `in ${list('languages').map(languageName).join('/')}` : '',
    obj['remoteOnly'] === true ? 'remote' : '',
    obj['skipFluentGerman'] === true ? 'no fluent German' : '',
    list('employmentTypes').join(', '),
    list('excludeTitles').length ? `not ${list('excludeTitles').join(', ')}` : '',
    typeof obj['minSalaryEur'] === 'number' ? `€${obj['minSalaryEur'].toLocaleString('en')}+` : '',
  ];
  return [list('titles'), list('skills'), list('countryCodes'), list('locations')]
    .filter((part) => part.length > 0)
    .map((part) => part.join(', '))
    .concat(extras.filter(Boolean))
    .join(' · ');
}

function toRunModel(run: RunRow, canContinue = false): SyncRunModel {
  return {
    id: run.id,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    complete: run.complete,
    fetched: run.fetched,
    created: run.created,
    updated: run.updated,
    creditsCharged: run.creditsCharged,
    jobsAlreadyPaid: run.jobsAlreadyPaid,
    savedSearchId: run.savedSearchId,
    savedSearchName: run.savedSearch?.name ?? null,
    scheduled: run.scheduled,
    summary: summarize(run.input),
    source: sourceOf(run.input),
    boards: listOf(run.input, 'boards'),
    canContinue,
  };
}

/** A stored import's input as a new import of the same search that picks up where it stopped. */
function continueInput(stored: Prisma.JsonValue): SyncJobsInput {
  const obj = (stored ?? {}) as Record<string, unknown>;
  const num = (key: string, fallback: number) =>
    typeof obj[key] === 'number' ? obj[key] : fallback;
  return {
    source: sourceOf(stored),
    boards: listOf(stored, 'boards'),
    titles: listOf(stored, 'titles'),
    skills: listOf(stored, 'skills'),
    countryCodes: listOf(stored, 'countryCodes'),
    locations: listOf(stored, 'locations'),
    languages: listOf(stored, 'languages'),
    skipFluentGerman: obj['skipFluentGerman'] === true,
    remoteOnly: obj['remoteOnly'] === true,
    excludeTitles: listOf(stored, 'excludeTitles'),
    employmentTypes: listOf(stored, 'employmentTypes'),
    minSalaryEur: typeof obj['minSalaryEur'] === 'number' ? obj['minSalaryEur'] : null,
    maxAgeDays: num('maxAgeDays', 7),
    pageSize: num('pageSize', 10),
    maxPages: num('maxPages', 1),
    onlyNew: obj['onlyNew'] === true,
    resume: true,
  };
}

/** Saved searches you can run again in one click, and the history of every import. */
@Injectable()
export class SavedSearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
    private readonly settings: SettingsService,
  ) {}

  async list(userId: number): Promise<SavedSearch[]> {
    const rows = await this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { runs: { orderBy: { id: 'desc' }, take: 1, include: withSearchName } },
    });
    return rows.map(({ runs, ...row }) => ({
      ...row,
      lastRun: runs[0]
        ? toRunModel(runs[0], !runs[0].complete && runs[0].nextCursor !== null)
        : null,
    }));
  }

  async history(userId: number, limit: number, savedSearchId?: number): Promise<SyncRunModel[]> {
    const runs = await this.prisma.syncRun.findMany({
      where: savedSearchId === undefined ? { userId } : { userId, savedSearchId },
      orderBy: { id: 'desc' },
      take: limit,
      include: withSearchName,
    });
    // Only the newest import of a search keeps a cursor that still works.
    const stopped = runs.filter((run) => !run.complete && run.nextCursor);
    const newest = new Map<string, number>();
    if (stopped.length > 0) {
      const latest = await this.prisma.syncRun.findMany({
        where: { userId, searchKey: { in: [...new Set(stopped.map((run) => run.searchKey))] } },
        orderBy: { id: 'desc' },
        distinct: ['searchKey'],
        select: { id: true, searchKey: true },
      });
      for (const row of latest) newest.set(row.searchKey, row.id);
    }
    return runs.map((run) =>
      toRunModel(run, stopped.includes(run) && newest.get(run.searchKey) === run.id),
    );
  }

  /** "Continue" in the import history: fetch the pages an import left, with the same search. */
  async continueRun(userId: number, runId: number): Promise<SyncJobsResult> {
    const run = await this.prisma.syncRun.findFirst({ where: { id: runId, userId } });
    if (!run)
      throw apiError(NotFoundException, 'SYNC_RUN_NOT_FOUND', `Import ${runId} not found`, {
        id: runId,
      });
    return this.sync.sync(continueInput(run.input), {
      userId,
      ...(run.savedSearchId === null ? {} : { savedSearchId: run.savedSearchId }),
    });
  }

  async create(userId: number, input: SavedSearchInput): Promise<SavedSearch> {
    // Admin › Limits: keeps the morning runs short when many people use the app.
    const { maxSavedSearches } = await this.settings.get();
    if ((await this.prisma.savedSearch.count({ where: { userId } })) >= maxSavedSearches) {
      throw apiError(
        BadRequestException,
        'SAVED_SEARCHES_FULL',
        `You can keep up to ${maxSavedSearches} saved ${maxSavedSearches === 1 ? 'search' : 'searches'}. Delete one first.`,
        { max: maxSavedSearches },
      );
    }
    const row = await this.withUniqueName(input.name, () =>
      this.prisma.savedSearch.create({ data: { ...toData(input), userId } }),
    );
    return { ...row, lastRun: null };
  }

  async update(userId: number, id: number, input: SavedSearchInput): Promise<SavedSearch> {
    await this.findRow(userId, id);
    await this.withUniqueName(input.name, () =>
      this.prisma.savedSearch.update({ where: { id }, data: toData(input) }),
    );
    const updated = (await this.list(userId)).find((s) => s.id === id);
    if (!updated)
      throw apiError(NotFoundException, 'SAVED_SEARCH_NOT_FOUND', `Saved search ${id} not found`, {
        id,
      });
    return updated;
  }

  async setSchedule(
    userId: number,
    id: number,
    schedule: ScheduleFrequency,
    runAt: string,
  ): Promise<SavedSearch> {
    await this.findRow(userId, id);
    await this.prisma.savedSearch.update({
      where: { id },
      data: {
        schedule,
        runAt,
        nextRunAt: nextRunAfter(schedule, runAt, new Date()),
        scheduleNote: null,
      },
    });
    const updated = (await this.list(userId)).find((s) => s.id === id);
    if (!updated)
      throw apiError(NotFoundException, 'SAVED_SEARCH_NOT_FOUND', `Saved search ${id} not found`, {
        id,
      });
    return updated;
  }

  /** Saves a search's Autopilot rules. Hiding must stay below the queue limit. */
  async setAutopilot(userId: number, id: number, input: AutopilotInput): Promise<SavedSearch> {
    await this.findRow(userId, id);
    if (input.autoHideFitBelow >= input.autoQueueFitMin) {
      throw apiError(
        BadRequestException,
        'AUTOPILOT_LIMITS',
        'The hide limit must be lower than the queue limit',
        { hide: input.autoHideFitBelow, queue: input.autoQueueFitMin },
      );
    }
    await this.prisma.savedSearch.update({
      where: { id },
      data: {
        autopilot: input.autopilot,
        autoQueueFitMin: input.autoQueueFitMin,
        autoQueueNeedsVisa: input.autoQueueNeedsVisa,
        autoHideFitBelow: input.autoHideFitBelow,
        autoQueueMaxPerDay: input.autoQueueMaxPerDay,
      },
    });
    const updated = (await this.list(userId)).find((s) => s.id === id);
    if (!updated)
      throw apiError(NotFoundException, 'SAVED_SEARCH_NOT_FOUND', `Saved search ${id} not found`, {
        id,
      });
    return updated;
  }

  async remove(userId: number, id: number): Promise<boolean> {
    await this.findRow(userId, id);
    // Its imports stay in the history; their link is cleared (onDelete: SetNull).
    await this.prisma.savedSearch.delete({ where: { id } });
    return true;
  }

  async run(
    userId: number,
    id: number,
    resume: boolean,
    options: { scheduled?: boolean } = {},
  ): Promise<SyncJobsResult> {
    const row = await this.findRow(userId, id);
    const input: SyncJobsInput = {
      source: row.source,
      boards: row.boards,
      titles: row.titles,
      skills: row.skills,
      countryCodes: row.countryCodes,
      locations: row.locations,
      languages: row.languages,
      skipFluentGerman: row.skipFluentGerman,
      remoteOnly: row.remoteOnly,
      excludeTitles: row.excludeTitles,
      employmentTypes: row.employmentTypes,
      minSalaryEur: row.minSalaryEur,
      maxAgeDays: row.maxAgeDays,
      pageSize: row.pageSize,
      maxPages: row.maxPages,
      onlyNew: row.onlyNew,
      resume,
    };
    // The search's owner pays, also when the scheduler starts it.
    return this.sync.sync(input, {
      userId: row.userId,
      savedSearchId: row.id,
      scheduled: options.scheduled ?? false,
    });
  }

  /** Only your own searches: someone else's is "not found". */
  private async findRow(userId: number, id: number): Promise<SavedSearchRow> {
    const row = await this.prisma.savedSearch.findFirst({ where: { id, userId } });
    if (!row)
      throw apiError(NotFoundException, 'SAVED_SEARCH_NOT_FOUND', `Saved search ${id} not found`, {
        id,
      });
    return row;
  }

  private async withUniqueName<T>(name: string, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      // P2002 = unique constraint failed: another of your searches already has this name.
      if ((error as { code?: string }).code === 'P2002') {
        throw apiError(
          BadRequestException,
          'SAVED_SEARCH_NAME_TAKEN',
          `A saved search named "${name}" already exists`,
          { name },
        );
      }
      throw error;
    }
  }
}

function toData(input: SavedSearchInput) {
  return {
    name: input.name.trim(),
    source: input.source,
    boards: input.boards ?? [],
    titles: input.titles,
    skills: input.skills ?? [],
    countryCodes: (input.countryCodes ?? []).map((c) => c.toUpperCase()),
    locations: input.locations ?? [],
    languages: (input.languages ?? []).map((l) => l.toLowerCase()),
    skipFluentGerman: input.skipFluentGerman,
    remoteOnly: input.remoteOnly,
    excludeTitles: input.excludeTitles ?? [],
    employmentTypes: input.employmentTypes ?? [],
    minSalaryEur: input.minSalaryEur ?? null,
    maxAgeDays: input.maxAgeDays,
    pageSize: input.pageSize,
    maxPages: input.maxPages,
    onlyNew: input.onlyNew,
  };
}
