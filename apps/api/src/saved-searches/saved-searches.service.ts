import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, SavedSearch as SavedSearchRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncJobsInput, SyncJobsResult } from '../sync/sync.input';
import { SyncService } from '../sync/sync.service';
import type { SavedSearch, SavedSearchInput, SyncRunModel } from './saved-search.model';
import type { ScheduleFrequency } from './schedule';
import { nextRunAfter } from './schedule';

type RunRow = Prisma.SyncRunGetPayload<{ include: { savedSearch: { select: { name: true } } } }>;

const withSearchName = { savedSearch: { select: { name: true } } } satisfies Prisma.SyncRunInclude;

/** "frontend, react dev · DE · Berlin" from the input an import stored. */
export function summarize(input: Prisma.JsonValue): string {
  const obj = (input ?? {}) as Record<string, unknown>;
  const list = (key: string) => (Array.isArray(obj[key]) ? (obj[key] as string[]) : []);
  return [list('titles'), list('skills'), list('countryCodes'), list('locations')]
    .filter((part) => part.length > 0)
    .map((part) => part.join(', '))
    .join(' · ');
}

export function toRunModel(run: RunRow): SyncRunModel {
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
  };
}

/** Saved searches you can run again in one click, and the history of every import. */
@Injectable()
export class SavedSearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {}

  async list(): Promise<SavedSearch[]> {
    const rows = await this.prisma.savedSearch.findMany({
      orderBy: { name: 'asc' },
      include: { runs: { orderBy: { id: 'desc' }, take: 1, include: withSearchName } },
    });
    return rows.map(({ runs, ...row }) => ({
      ...row,
      lastRun: runs[0] ? toRunModel(runs[0]) : null,
    }));
  }

  async history(limit: number, savedSearchId?: number): Promise<SyncRunModel[]> {
    const runs = await this.prisma.syncRun.findMany({
      where: savedSearchId === undefined ? {} : { savedSearchId },
      orderBy: { id: 'desc' },
      take: limit,
      include: withSearchName,
    });
    return runs.map(toRunModel);
  }

  async create(input: SavedSearchInput): Promise<SavedSearch> {
    const row = await this.withUniqueName(input.name, () =>
      this.prisma.savedSearch.create({ data: toData(input) }),
    );
    return { ...row, lastRun: null };
  }

  async update(id: number, input: SavedSearchInput): Promise<SavedSearch> {
    await this.findRow(id);
    await this.withUniqueName(input.name, () =>
      this.prisma.savedSearch.update({ where: { id }, data: toData(input) }),
    );
    const updated = (await this.list()).find((s) => s.id === id);
    if (!updated) throw new NotFoundException(`Saved search ${id} not found`);
    return updated;
  }

  async setSchedule(id: number, schedule: ScheduleFrequency, runAt: string): Promise<SavedSearch> {
    await this.findRow(id);
    await this.prisma.savedSearch.update({
      where: { id },
      data: {
        schedule,
        runAt,
        nextRunAt: nextRunAfter(schedule, runAt, new Date()),
        scheduleNote: null,
      },
    });
    const updated = (await this.list()).find((s) => s.id === id);
    if (!updated) throw new NotFoundException(`Saved search ${id} not found`);
    return updated;
  }

  async remove(id: number): Promise<boolean> {
    await this.findRow(id);
    // Its imports stay in the history; their link is cleared (onDelete: SetNull).
    await this.prisma.savedSearch.delete({ where: { id } });
    return true;
  }

  async run(
    id: number,
    resume: boolean,
    options: { scheduled?: boolean } = {},
  ): Promise<SyncJobsResult> {
    const row = await this.findRow(id);
    const input: SyncJobsInput = {
      titles: row.titles,
      skills: row.skills,
      countryCodes: row.countryCodes,
      locations: row.locations,
      maxAgeDays: row.maxAgeDays,
      pageSize: row.pageSize,
      maxPages: row.maxPages,
      onlyNew: row.onlyNew,
      resume,
    };
    return this.sync.sync(input, { savedSearchId: row.id, scheduled: options.scheduled ?? false });
  }

  private async findRow(id: number): Promise<SavedSearchRow> {
    const row = await this.prisma.savedSearch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Saved search ${id} not found`);
    return row;
  }

  private async withUniqueName<T>(name: string, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      // P2002 = unique constraint failed: another search already has this name.
      if ((error as { code?: string }).code === 'P2002') {
        throw new BadRequestException(`A saved search named "${name}" already exists`);
      }
      throw error;
    }
  }
}

function toData(input: SavedSearchInput) {
  return {
    name: input.name.trim(),
    titles: input.titles,
    skills: input.skills ?? [],
    countryCodes: (input.countryCodes ?? []).map((c) => c.toUpperCase()),
    locations: input.locations ?? [],
    maxAgeDays: input.maxAgeDays,
    pageSize: input.pageSize,
    maxPages: input.maxPages,
    onlyNew: input.onlyNew,
  };
}
