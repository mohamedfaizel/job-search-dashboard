import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SchedulerService } from '../src/saved-searches/scheduler.service';
import { loadSearchResponse } from './fixtures/load';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase } from './helpers';

const JOBSPIPE_URL = 'https://jobspipe.test/v1';

const SET_SCHEDULE = /* GraphQL */ `
  mutation ($id: Int!, $input: ScheduleInput!) {
    setSavedSearchSchedule(id: $id, input: $input) {
      schedule
      runAt
      nextRunAt
      scheduleNote
    }
  }
`;

let jobsPipeStatus = 200;
const server = setupServer(
  http.post(`${JOBSPIPE_URL}/jobs/search`, () =>
    jobsPipeStatus === 200
      ? HttpResponse.json(loadSearchResponse())
      : new HttpResponse(null, { status: jobsPipeStatus, statusText: 'Payment Required' }),
  ),
);

describe('scheduled imports', () => {
  let t: TestApp;
  let scheduler: SchedulerService;

  beforeAll(async () => {
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({
      JOBSPIPE_API_URL: JOBSPIPE_URL,
      JOBSPIPE_API_TOKEN: 'jp_test',
      DAILY_CREDIT_CAP: '60',
    });
    scheduler = t.app.get(SchedulerService);
  });
  afterAll(async () => {
    await t.app.close();
    server.close();
  });
  beforeEach(async () => {
    jobsPipeStatus = 200;
    await resetDatabase(t.prisma);
  });

  /** A saved search (25 jobs × 1 page = up to 25 credits) that was due a minute ago. */
  async function dueSearch(name = 'Frontend') {
    return t.prisma.savedSearch.create({
      data: {
        name,
        titles: ['frontend'],
        schedule: 'DAILY',
        runAt: '07:00',
        nextRunAt: new Date(Date.now() - 60_000),
      },
    });
  }

  it('turns a schedule on with the next run time', async () => {
    const search = await t.prisma.savedSearch.create({ data: { name: 'Frontend', titles: ['x'] } });

    const res = await t.gql<{ setSavedSearchSchedule: { nextRunAt: string } }>(SET_SCHEDULE, {
      id: search.id,
      input: { schedule: 'DAILY', runAt: '07:30' },
    });

    expect(res.data!.setSavedSearchSchedule).toMatchObject({ schedule: 'DAILY', runAt: '07:30' });
    const next = new Date(res.data!.setSavedSearchSchedule.nextRunAt);
    expect([next.getHours(), next.getMinutes()]).toEqual([7, 30]);
    expect(next.getTime()).toBeGreaterThan(Date.now());
  });

  it('turns a schedule off', async () => {
    const search = await dueSearch();
    const res = await t.gql(SET_SCHEDULE, { id: search.id, input: { schedule: 'OFF' } });
    expect(res.data).toMatchObject({
      setSavedSearchSchedule: { schedule: 'OFF', nextRunAt: null },
    });
  });

  it('rejects a time that is not HH:mm', async () => {
    const search = await dueSearch();
    const res = await t.gql(SET_SCHEDULE, {
      id: search.id,
      input: { schedule: 'DAILY', runAt: '7am' },
    });
    expect(res.errors?.[0]?.message).toMatch(/runAt must be a time like 07:30/);
  });

  it('runs due searches, marks the import as scheduled and books the next run', async () => {
    const search = await dueSearch();
    await t.prisma.savedSearch.create({
      data: {
        name: 'Not due',
        titles: ['backend'],
        schedule: 'DAILY',
        nextRunAt: new Date(Date.now() + 3_600_000),
      },
    });

    expect(await scheduler.runDue(new Date())).toBe(1);

    const runs = await t.prisma.syncRun.findMany();
    expect(runs).toEqual([expect.objectContaining({ savedSearchId: search.id, scheduled: true })]);
    const after = await t.prisma.savedSearch.findUniqueOrThrow({ where: { id: search.id } });
    expect(after.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(after.scheduleNote).toMatch(/^Ran at .+: 3 new, 0 already saved\.$/);
  });

  it('skips a run that could go over the daily credit cap', async () => {
    // 3 credits used today; a search that may cost up to 25 × 3 = 75 would pass the cap of 60.
    await t.gql(`mutation { syncJobs(input: { titles: ["backend"] }) { fetched } }`);
    const search = await dueSearch();
    await t.prisma.savedSearch.update({ where: { id: search.id }, data: { maxPages: 3 } });

    expect(await scheduler.runDue(new Date())).toBe(0);

    const after = await t.prisma.savedSearch.findUniqueOrThrow({ where: { id: search.id } });
    expect(after.scheduleNote).toMatch(
      /^Skipped at .+: it can use up to 75 credits and 3 of today's 60 are used\.$/,
    );
    expect(after.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await t.prisma.syncRun.count({ where: { scheduled: true } })).toBe(0);
  });

  it('notes a failed run and still books the next one', async () => {
    jobsPipeStatus = 402;
    const search = await dueSearch();

    expect(await scheduler.runDue(new Date())).toBe(0);

    const after = await t.prisma.savedSearch.findUniqueOrThrow({ where: { id: search.id } });
    expect(after.scheduleNote).toMatch(/^Failed at .+: JobsPipe search failed: 402/);
    expect(after.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("reports today's credits against the cap", async () => {
    await t.gql(`mutation { syncJobs(input: { titles: ["backend"] }) { fetched } }`);
    const res = await t.gql(`query { importBudget { used cap } }`);
    expect(res.data).toEqual({ importBudget: { used: 3, cap: 60 } });
  });
});
