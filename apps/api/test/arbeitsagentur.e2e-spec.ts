import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SchedulerService } from '../src/saved-searches/scheduler.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const BA_URL = 'https://ba.test/jobsuche-service';
const AD =
  'Wir suchen Verstärkung für unser Team in Berlin. Sie entwickeln mit React und TypeScript moderne Weboberflächen und arbeiten eng mit dem Design zusammen.';

const SYNC = /* GraphQL */ `
  mutation Sync($input: SyncJobsInput!) {
    syncJobs(input: $input) {
      pages
      fetched
      created
      updated
      hasMore
      creditsCharged
      resumed
      totalAvailable
    }
  }
`;
const SAVE = /* GraphQL */ `
  mutation ($input: SavedSearchInput!) {
    createSavedSearch(input: $input) {
      id
      source
    }
  }
`;
const RUN = /* GraphQL */ `
  mutation ($id: Int!) {
    runSavedSearch(id: $id) {
      created
      creditsCharged
    }
  }
`;

const listing = (n: number) => ({
  refnr: `10001-000000${n}-S`,
  titel: `Frontend Entwickler ${n}`,
  beruf: 'Softwareentwickler/in',
  arbeitgeber: `Firma ${n}`,
  arbeitsort: { ort: 'Berlin', region: 'Berlin', land: 'Deutschland' },
  aktuelleVeroeffentlichungsdatum: '2026-11-02',
});

let searches: URLSearchParams[] = [];
let detailRequests: string[] = [];
let failDetails = false;
let apiKeys: (string | null)[] = [];
const server = setupServer(
  http.get(`${BA_URL}/pc/v4/jobs`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    searches.push(params);
    apiKeys.push(request.headers.get('x-api-key'));
    // 3 matches in total, 2 per page.
    const page = Number(params.get('page'));
    const all = [1, 2, 3].map(listing);
    return HttpResponse.json({
      stellenangebote: all.slice((page - 1) * 2, page * 2),
      maxErgebnisse: 3,
      page,
      size: 2,
    });
  }),
  http.get(`${BA_URL}/pc/v4/jobdetails/:id`, ({ params }) => {
    detailRequests.push(
      Buffer.from(decodeURIComponent(params['id'] as string), 'base64').toString(),
    );
    return failDetails
      ? new HttpResponse(null, { status: 500, statusText: 'Server Error' })
      : HttpResponse.json({ stellenbeschreibung: `<p>${AD}</p>` });
  }),
);

describe('Arbeitsagentur import', () => {
  let t: TestApp;
  let scheduler: SchedulerService;

  beforeAll(async () => {
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({ ARBEITSAGENTUR_API_URL: BA_URL, DAILY_CREDIT_CAP: '1' });
    scheduler = t.app.get(SchedulerService);
  });
  afterAll(async () => {
    await t.app.close();
    server.close();
  });
  beforeEach(async () => {
    searches = [];
    detailRequests = [];
    apiKeys = [];
    failDetails = false;
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  const input = (over: Record<string, unknown> = {}) => ({
    source: 'ARBEITSAGENTUR',
    titles: ['frontend'],
    locations: ['Berlin'],
    maxAgeDays: 7,
    pageSize: 2,
    maxPages: 5,
    onlyNew: true,
    ...over,
  });

  it('saves jobs with their full ad, for free', async () => {
    const res = await t.gql<{ syncJobs: Record<string, unknown> }>(SYNC, { input: input() });

    expect(res.errors).toBeUndefined();
    expect(res.data?.syncJobs).toMatchObject({
      pages: 2,
      fetched: 3,
      created: 3,
      updated: 0,
      hasMore: false,
      creditsCharged: 0,
      totalAvailable: 3,
    });
    const job = await t.prisma.job.findUniqueOrThrow({
      where: { externalId: 'ba:10001-0000001-S' },
      include: { company: true },
    });
    expect(job).toMatchObject({
      source: 'ARBEITSAGENTUR',
      title: 'Frontend Entwickler 1',
      provider: 'arbeitsagentur',
      countryCode: 'DE',
      city: 'Berlin',
      language: 'de',
      description: expect.stringContaining('React und TypeScript'),
    });
    expect(job.company.name).toBe('Firma 1');
    expect(apiKeys).toEqual(['jobboerse-jobsuche', 'jobboerse-jobsuche']);
    expect(detailRequests.sort((a, b) => a.localeCompare(b))).toEqual(
      [1, 2, 3].map((n) => `10001-000000${n}-S`),
    );
  });

  it('sends the search the board understands', async () => {
    await t.gql(SYNC, {
      input: input({
        titles: ['frontend', 'react'],
        employmentTypes: ['full-time'],
        remoteOnly: true,
        maxPages: 1,
      }),
    });

    const first = searches[0]!;
    expect(first.get('was')).toBe('frontend react');
    expect(first.get('wo')).toBe('Berlin');
    expect(first.get('veroeffentlichtseit')).toBe('7');
    expect(first.get('arbeitszeit')).toBe('vz;ho');
    expect(first.get('size')).toBe('2');
  });

  it('does not fetch jobs it already has', async () => {
    await t.gql(SYNC, { input: input({ onlyNew: false }) });
    detailRequests = [];

    const again = await t.gql<{ syncJobs: Record<string, unknown> }>(SYNC, {
      input: input({ onlyNew: false }),
    });

    expect(again.data?.syncJobs).toMatchObject({ fetched: 3, created: 0, updated: 3 });
    expect(detailRequests).toEqual([]);
    expect(await t.prisma.job.count()).toBe(3);
  });

  it('asks only for the days since the last run when "only new" is on', async () => {
    await t.gql(SYNC, { input: input({ maxAgeDays: 30 }) });
    searches = [];

    await t.gql(SYNC, { input: input({ maxAgeDays: 30 }) });

    // Moments after the first run: the day it ran, plus one day of overlap.
    expect(searches[0]?.get('veroeffentlichtseit')).toBe('2');
  });

  it('continues from the page where it stopped', async () => {
    const first = await t.gql<{ syncJobs: Record<string, unknown> }>(SYNC, {
      input: input({ maxPages: 1 }),
    });
    expect(first.data?.syncJobs).toMatchObject({ pages: 1, created: 2, hasMore: true });

    const rest = await t.gql<{ syncJobs: Record<string, unknown> }>(SYNC, {
      input: input({ maxPages: 1, resume: true }),
    });

    expect(rest.data?.syncJobs).toMatchObject({
      pages: 1,
      created: 1,
      hasMore: false,
      resumed: true,
    });
    expect(await t.prisma.job.count()).toBe(3);
  });

  it('keeps a job whose full ad could not be read', async () => {
    failDetails = true;

    const res = await t.gql<{ syncJobs: Record<string, unknown> }>(SYNC, { input: input() });

    expect(res.data?.syncJobs).toMatchObject({ created: 3 });
    const job = await t.prisma.job.findFirstOrThrow({ where: { source: 'ARBEITSAGENTUR' } });
    expect(job.description).toBeNull();
  });

  it('skips titles you excluded', async () => {
    const res = await t.gql<{ syncJobs: Record<string, unknown> }>(SYNC, {
      input: input({ excludeTitles: ['Entwickler 2'] }),
    });
    expect(res.data?.syncJobs).toMatchObject({ created: 2 });
    expect(await t.prisma.job.findFirst({ where: { title: 'Frontend Entwickler 2' } })).toBeNull();
  });

  it('runs as a saved search, and the scheduler ignores the credit cap for it', async () => {
    const saved = await t.gql<{ createSavedSearch: { id: number; source: string } }>(SAVE, {
      input: { name: 'Berlin free', ...input() },
    });
    expect(saved.errors).toBeUndefined();
    expect(saved.data?.createSavedSearch.source).toBe('ARBEITSAGENTUR');
    const id = saved.data!.createSavedSearch.id;
    await t.prisma.savedSearch.update({
      where: { id },
      data: { schedule: 'DAILY', nextRunAt: new Date(Date.now() - 60_000) },
    });

    // DAILY_CREDIT_CAP is 1 and this search could "use" 10: a JobsPipe search would be skipped.
    const ran = await scheduler.runDue(new Date());

    expect(ran).toBe(1);
    expect(await t.prisma.job.count()).toBe(3);
    const run = await t.gql<{ runSavedSearch: { created: number; creditsCharged: number } }>(RUN, {
      id,
    });
    expect(run.data?.runSavedSearch).toEqual({ created: 0, creditsCharged: 0 });
  });
});
