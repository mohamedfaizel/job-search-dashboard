import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SchedulerService } from '../src/saved-searches/scheduler.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const SYNC = /* GraphQL */ `
  mutation Sync($input: SyncJobsInput!) {
    syncJobs(input: $input) {
      pages
      fetched
      created
      updated
      hasMore
      creditsCharged
      totalAvailable
      warnings
    }
  }
`;
const SAVE = /* GraphQL */ `
  mutation ($input: SavedSearchInput!) {
    createSavedSearch(input: $input) {
      id
      source
      boards
    }
  }
`;

const today = new Date().toISOString();
const AD = '<p>Build the web app with React and TypeScript in our Berlin office.</p>';
let requested: string[] = [];

const server = setupServer(
  http.get('https://boards-api.greenhouse.io/v1/boards/:slug/jobs', ({ params }) => {
    requested.push(`greenhouse:${String(params['slug'])}`);
    if (params['slug'] === 'gone')
      return new HttpResponse(null, { status: 404, statusText: 'Not Found' });
    return HttpResponse.json({
      jobs: [
        {
          id: 1,
          title: 'Frontend Engineer',
          absolute_url: 'https://boards.greenhouse.io/acme/jobs/1',
          location: { name: 'Berlin' },
          first_published: today,
          company_name: 'Acme',
          content: AD.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        },
        {
          id: 2,
          title: 'Account Executive',
          absolute_url: 'https://boards.greenhouse.io/acme/jobs/2',
          location: { name: 'Berlin' },
          first_published: today,
        },
      ],
    });
  }),
  http.get('https://api.lever.co/v0/postings/:slug', ({ params }) => {
    requested.push(`lever:${String(params['slug'])}`);
    return HttpResponse.json([
      {
        id: 'lv-1',
        text: 'Frontend Developer',
        hostedUrl: 'https://jobs.lever.co/netflix/lv-1',
        createdAt: Date.now(),
        workplaceType: 'remote',
        descriptionPlain: 'Build streaming UIs with React.',
        categories: { location: 'Remote', team: 'UI', commitment: 'Full-time' },
      },
    ]);
  }),
  http.get('https://api.ashbyhq.com/posting-api/job-board/:slug', ({ params }) => {
    requested.push(`ashby:${String(params['slug'])}`);
    return HttpResponse.json({
      jobs: [
        {
          id: 'ab-1',
          title: 'Frontend Engineer',
          jobUrl: 'https://jobs.ashbyhq.com/ramp/ab-1',
          location: 'New York',
          employmentType: 'FullTime',
          publishedAt: today,
          descriptionPlain: 'Ship the product.',
        },
      ],
    });
  }),
);

describe('Company board import', () => {
  let t: TestApp;
  let scheduler: SchedulerService;

  beforeAll(async () => {
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({ DAILY_CREDIT_CAP: '1' });
    scheduler = t.app.get(SchedulerService);
  });
  afterAll(async () => {
    await t.app.close();
    server.close();
  });
  beforeEach(async () => {
    requested = [];
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  const input = (over: Record<string, unknown> = {}) => ({
    source: 'COMPANY_BOARDS',
    boards: ['greenhouse:acme', 'https://jobs.lever.co/netflix', 'ashby:ramp'],
    titles: ['frontend'],
    maxAgeDays: 7,
    pageSize: 25,
    maxPages: 1,
    onlyNew: true,
    ...over,
  });

  it('saves the matching postings of every board, for free', async () => {
    const res = await t.gql<{ syncJobs: Record<string, unknown> }>(SYNC, { input: input() });

    expect(res.errors).toBeUndefined();
    expect(res.data?.syncJobs).toMatchObject({
      pages: 3,
      fetched: 3,
      created: 3,
      updated: 0,
      hasMore: false,
      creditsCharged: 0,
      warnings: [],
    });
    expect(requested.sort((a, b) => a.localeCompare(b))).toEqual([
      'ashby:ramp',
      'greenhouse:acme',
      'lever:netflix',
    ]);
    const job = await t.prisma.job.findUniqueOrThrow({
      where: { externalId: 'greenhouse:acme:1' },
      include: { company: true },
    });
    expect(job).toMatchObject({
      source: 'COMPANY_BOARD',
      provider: 'greenhouse',
      title: 'Frontend Engineer',
      url: 'https://boards.greenhouse.io/acme/jobs/1',
      description: expect.stringContaining('React and TypeScript'),
    });
    expect(job.company.name).toBe('Acme');
    const remote = await t.prisma.job.findUniqueOrThrow({
      where: { externalId: 'lever:netflix:lv-1' },
    });
    expect(remote.workplace).toBe('REMOTE');
    expect(await t.prisma.job.findFirst({ where: { title: 'Account Executive' } })).toBeNull();
  });

  it('does not save a posting twice', async () => {
    await t.gql(SYNC, { input: input() });
    const again = await t.gql<{ syncJobs: Record<string, unknown> }>(SYNC, { input: input() });

    expect(again.data?.syncJobs).toMatchObject({ created: 0, updated: 3 });
    expect(await t.prisma.job.count()).toBe(3);
  });

  it('filters by place', async () => {
    const res = await t.gql<{ syncJobs: Record<string, unknown> }>(SYNC, {
      input: input({ locations: ['Berlin'] }),
    });
    expect(res.data?.syncJobs).toMatchObject({ created: 1 });
  });

  it('keeps going and warns when one board cannot be read', async () => {
    const res = await t.gql<{ syncJobs: { created: number; warnings: string[] } }>(SYNC, {
      input: input({ boards: ['greenhouse:gone', 'ashby:ramp'] }),
    });

    expect(res.errors).toBeUndefined();
    expect(res.data?.syncJobs.created).toBe(1);
    expect(res.data?.syncJobs.warnings).toEqual([expect.stringContaining('greenhouse:gone: 404')]);
  });

  it('says which board name it cannot read, and asks for at least one', async () => {
    const bad = await t.gql(SYNC, { input: input({ boards: ['nonsense'] }) });
    expect(bad.errors?.[0]?.extensions).toMatchObject({
      apiCode: 'INVALID_BOARD',
      apiParams: { entry: 'nonsense' },
    });
    const none = await t.gql(SYNC, { input: input({ boards: undefined }) });
    expect(none.errors?.[0]?.extensions).toMatchObject({ apiCode: 'NO_BOARDS' });
  });

  it('records the import in the history', async () => {
    await t.gql(SYNC, { input: input() });
    const run = await t.prisma.syncRun.findFirstOrThrow();
    expect(run).toMatchObject({ complete: true, created: 3, creditsCharged: 0 });
    expect(JSON.stringify(run.input)).toContain('greenhouse:acme');
  });

  it('runs as a saved search that the scheduler ignores the credit cap for', async () => {
    const saved = await t.gql<{ createSavedSearch: { id: number; boards: string[] } }>(SAVE, {
      input: { name: 'Boards', ...input() },
    });
    expect(saved.errors).toBeUndefined();
    expect(saved.data?.createSavedSearch.boards).toHaveLength(3);
    await t.prisma.savedSearch.update({
      where: { id: saved.data!.createSavedSearch.id },
      data: { schedule: 'DAILY', nextRunAt: new Date(Date.now() - 60_000) },
    });

    const ran = await scheduler.runDue(new Date());

    expect(ran).toBe(1);
    expect(await t.prisma.job.count()).toBe(3);
  });
});
