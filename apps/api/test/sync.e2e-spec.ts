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
});
