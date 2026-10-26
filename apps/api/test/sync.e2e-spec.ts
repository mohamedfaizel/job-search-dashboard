import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSearchResponse } from './fixtures/load';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase } from './helpers';

const JOBSPIPE_URL = 'https://jobspipe.test/v1';

const SYNC = /* GraphQL */ `
  mutation Sync($input: SyncJobsInput!) {
    syncJobs(input: $input) {
      pages
      fetched
      created
      updated
      hasMore
      creditsRemaining
      creditsCharged
      jobsAlreadyPaid
      newSince
    }
  }
`;

// Fake JobsPipe: the fixture's 3 jobs split over two pages (2 + 1) linked by a cursor.
const requests: Record<string, unknown>[] = [];
const server = setupServer(
  http.post(`${JOBSPIPE_URL}/jobs/search`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    requests.push(body);
    const fixture = loadSearchResponse();
    const firstPage = body['cursor'] === undefined;
    return HttpResponse.json({
      metadata: { ...fixture.metadata, next_cursor: firstPage ? 'page-2' : null },
      data: firstPage ? fixture.data.slice(0, 2) : fixture.data.slice(2),
    });
  }),
);

describe('syncJobs', () => {
  let t: TestApp;

  beforeAll(async () => {
    // Let local requests (supertest -> our API) through; only JobsPipe is faked.
    server.listen({ onUnhandledFrame: 'bypass' });
    t = await createTestApp({ JOBSPIPE_API_URL: JOBSPIPE_URL, JOBSPIPE_API_TOKEN: 'jp_test' });
  });
  afterAll(async () => {
    await t.app.close();
    server.close();
  });
  beforeEach(async () => {
    requests.length = 0;
    await resetDatabase(t.prisma);
  });

  it('follows the cursor and saves every job', async () => {
    const res = await t.gql(SYNC, {
      input: { titles: ['frontend'], skills: ['react'], countryCodes: ['de'], maxPages: 5 },
    });

    expect(res.data).toEqual({
      syncJobs: {
        pages: 2,
        fetched: 3,
        created: 3,
        updated: 0,
        hasMore: false,
        creditsRemaining: 766,
        creditsCharged: 6,
        jobsAlreadyPaid: 0,
        newSince: null,
      },
    });
    expect(requests[0]).toMatchObject({
      job_title_or: ['frontend'],
      skills_or: ['react'],
      job_country_code_or: ['DE'],
    });
    expect(requests[1]).toMatchObject({ cursor: 'page-2' });
    expect(await t.prisma.job.count()).toBe(3);
  });

  it('stops at maxPages and reports that more are available', async () => {
    const res = await t.gql(SYNC, { input: { titles: ['frontend'], maxPages: 1 } });
    expect(res.data).toMatchObject({ syncJobs: { pages: 1, fetched: 2, hasMore: true } });
  });

  it('updates existing jobs on re-sync without losing your application status', async () => {
    await t.gql(SYNC, { input: { titles: ['frontend'], maxPages: 5 } });
    const job = await t.prisma.job.findFirstOrThrow({ where: { externalId: '8a5adb17ca3a27ec' } });
    await t.prisma.job.update({ where: { id: job.id }, data: { applicationStatus: 'APPLIED' } });

    const res = await t.gql(SYNC, { input: { titles: ['frontend'], maxPages: 5 } });

    expect(res.data).toMatchObject({ syncJobs: { created: 0, updated: 3 } });
    expect(await t.prisma.job.count()).toBe(3);
    const after = await t.prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.applicationStatus).toBe('APPLIED');
  });

  describe('only new jobs', () => {
    it('asks only for postings found since the last run of the same search', async () => {
      const before = Date.now();
      await t.gql(SYNC, { input: { titles: ['Frontend'], countryCodes: ['de'], maxPages: 5 } });
      expect(requests[0]).not.toHaveProperty('discovered_at_gte');

      requests.length = 0;
      // Same search, different order and case: it counts as the same search.
      const res = await t.gql<{ syncJobs: { newSince: string } }>(SYNC, {
        input: { titles: ['frontend '], countryCodes: ['DE'], maxPages: 5 },
      });

      const newSince = new Date(res.data!.syncJobs.newSince).getTime();
      expect(newSince).toBeGreaterThanOrEqual(before - 1000);
      // Starts one hour before the previous run, in JobsPipe's "YYYY-MM-DD HH:mm:ss" UTC format.
      const expected = new Date(newSince - 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
      expect(requests[0]).toMatchObject({ discovered_at_gte: expected });
      expect(requests[1]).toMatchObject({ discovered_at_gte: expected, cursor: 'page-2' });
    });

    it('treats a different search as new', async () => {
      await t.gql(SYNC, { input: { titles: ['frontend'], maxPages: 5 } });
      requests.length = 0;

      const res = await t.gql(SYNC, { input: { titles: ['backend'], maxPages: 5 } });

      expect(res.data).toMatchObject({ syncJobs: { newSince: null } });
      expect(requests[0]).not.toHaveProperty('discovered_at_gte');
    });

    it('does not move the starting point after a run that left pages unfetched', async () => {
      await t.gql(SYNC, { input: { titles: ['frontend'], maxPages: 1 } });
      requests.length = 0;

      const res = await t.gql(SYNC, { input: { titles: ['frontend'], maxPages: 1 } });

      expect(res.data).toMatchObject({ syncJobs: { newSince: null } });
      expect(requests[0]).not.toHaveProperty('discovered_at_gte');
    });

    it('can be turned off to re-fetch everything', async () => {
      await t.gql(SYNC, { input: { titles: ['frontend'], maxPages: 5 } });
      requests.length = 0;

      const res = await t.gql(SYNC, {
        input: { titles: ['frontend'], maxPages: 5, onlyNew: false },
      });

      expect(res.data).toMatchObject({ syncJobs: { newSince: null, created: 0, updated: 3 } });
      expect(requests[0]).not.toHaveProperty('discovered_at_gte');
      expect(await t.prisma.job.count()).toBe(3);
    });
  });
});
