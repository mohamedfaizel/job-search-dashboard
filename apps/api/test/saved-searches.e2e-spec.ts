import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSearchResponse } from './fixtures/load';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase } from './helpers';

const JOBSPIPE_URL = 'https://jobspipe.test/v1';

const FIELDS = /* GraphQL */ `
  id
  name
  titles
  countryCodes
  locations
  languages
  skipFluentGerman
  remoteOnly
  excludeTitles
  employmentTypes
  minSalaryEur
  pageSize
  onlyNew
  lastRun {
    fetched
    created
    savedSearchName
    summary
  }
`;
const CREATE = `mutation ($input: SavedSearchInput!) { createSavedSearch(input: $input) { ${FIELDS} } }`;
const UPDATE = `mutation ($id: Int!, $input: SavedSearchInput!) { updateSavedSearch(id: $id, input: $input) { ${FIELDS} } }`;
const DELETE = `mutation ($id: Int!) { deleteSavedSearch(id: $id) }`;
const LIST = `query { savedSearches { ${FIELDS} } }`;
const RUN = `mutation ($id: Int!) { runSavedSearch(id: $id) { fetched created newSince } }`;
const HISTORY = `query { syncRuns { fetched savedSearchId savedSearchName summary complete } }`;

const requests: Record<string, unknown>[] = [];
const server = setupServer(
  http.post(`${JOBSPIPE_URL}/jobs/search`, async ({ request }) => {
    requests.push((await request.json()) as Record<string, unknown>);
    return HttpResponse.json(loadSearchResponse());
  }),
);

const SEARCH = {
  name: 'Frontend in Berlin',
  titles: ['frontend'],
  countryCodes: ['de'],
  locations: ['Berlin'],
  maxPages: 2,
};

interface Saved {
  id: number;
  name: string;
  lastRun: Record<string, unknown> | null;
}

describe('saved searches', () => {
  let t: TestApp;

  beforeAll(async () => {
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

  async function create(input: Record<string, unknown> = SEARCH): Promise<Saved> {
    const res = await t.gql<{ createSavedSearch: Saved }>(CREATE, { input });
    return res.data!.createSavedSearch;
  }

  it('saves a search with the import defaults', async () => {
    const saved = await create();

    expect(saved).toMatchObject({
      name: 'Frontend in Berlin',
      titles: ['frontend'],
      countryCodes: ['DE'],
      locations: ['Berlin'],
      pageSize: 25,
      onlyNew: true,
      lastRun: null,
    });
    expect(requests).toHaveLength(0);
  });

  it('refuses a second search with the same name', async () => {
    await create();
    const res = await t.gql(CREATE, { input: SEARCH });
    expect(res.errors?.[0]?.message).toBe(
      'A saved search named "Frontend in Berlin" already exists',
    );
  });

  it('refuses an empty name', async () => {
    const res = await t.gql(CREATE, { input: { ...SEARCH, name: '' } });
    expect(res.errors?.[0]?.message).toMatch(/name/);
  });

  it('runs a saved search and links the import to it', async () => {
    const saved = await create();

    const res = await t.gql(RUN, { id: saved.id });

    expect(res.data).toMatchObject({ runSavedSearch: { fetched: 3, created: 3, newSince: null } });
    expect(requests[0]).toMatchObject({
      job_title_or: ['frontend'],
      job_country_code_or: ['DE'],
      job_location_or: ['Berlin'],
    });
    const list = await t.gql<{ savedSearches: Saved[] }>(LIST);
    expect(list.data!.savedSearches[0]!.lastRun).toEqual({
      fetched: 3,
      created: 3,
      savedSearchName: 'Frontend in Berlin',
      summary: 'frontend · DE · Berlin',
    });
  });

  it('saves and runs the extra filters', async () => {
    const saved = await create({
      ...SEARCH,
      languages: ['en'],
      remoteOnly: true,
      skipFluentGerman: true,
      excludeTitles: ['Praktikum'],
      employmentTypes: ['contract'],
      minSalaryEur: 50000,
    });
    expect(saved).toMatchObject({
      languages: ['en'],
      remoteOnly: true,
      skipFluentGerman: true,
      excludeTitles: ['Praktikum'],
      employmentTypes: ['contract'],
      minSalaryEur: 50000,
    });

    await t.gql(RUN, { id: saved.id });

    expect(requests[0]).toMatchObject({
      language_or: ['en'],
      remote: true,
      job_title_not: ['Praktikum'],
      employment_type_or: ['contract'],
      min_salary_usd: 54000,
    });
    const list = await t.gql<{ savedSearches: Saved[] }>(LIST);
    expect(list.data!.savedSearches[0]!.lastRun).toMatchObject({
      summary:
        'frontend · DE · Berlin · in English · remote · no fluent German · contract · not Praktikum · €50,000+',
    });
  });

  it('only asks for new jobs on the next run', async () => {
    const saved = await create();
    await t.gql(RUN, { id: saved.id });
    requests.length = 0;

    const res = await t.gql<{ runSavedSearch: { newSince: string | null } }>(RUN, { id: saved.id });

    expect(res.data!.runSavedSearch.newSince).not.toBeNull();
    expect(requests[0]).toHaveProperty('discovered_at_gte');
  });

  it('lists every import, saved or not, newest first', async () => {
    const saved = await create();
    await t.gql(RUN, { id: saved.id });
    await t.gql(`mutation { syncJobs(input: { titles: ["backend"] }) { fetched } }`);

    const res = await t.gql(HISTORY);

    expect(res.data).toEqual({
      syncRuns: [
        {
          fetched: 3,
          savedSearchId: null,
          savedSearchName: null,
          summary: 'backend',
          complete: true,
        },
        {
          fetched: 3,
          savedSearchId: saved.id,
          savedSearchName: 'Frontend in Berlin',
          summary: 'frontend · DE · Berlin',
          complete: true,
        },
      ],
    });
  });

  it('updates a saved search', async () => {
    const saved = await create();

    const res = await t.gql<{ updateSavedSearch: Saved }>(UPDATE, {
      id: saved.id,
      input: { ...SEARCH, name: 'Frontend in Munich', locations: ['Munich'] },
    });

    expect(res.data!.updateSavedSearch).toMatchObject({
      id: saved.id,
      name: 'Frontend in Munich',
      locations: ['Munich'],
    });
  });

  it('keeps past imports in the history when a search is deleted', async () => {
    const saved = await create();
    await t.gql(RUN, { id: saved.id });

    const res = await t.gql(DELETE, { id: saved.id });

    expect(res.data).toEqual({ deleteSavedSearch: true });
    expect(await t.prisma.savedSearch.count()).toBe(0);
    const history = await t.gql(HISTORY);
    expect(history.data).toMatchObject({
      syncRuns: [{ savedSearchId: null, savedSearchName: null, summary: 'frontend · DE · Berlin' }],
    });
  });

  it('says when a saved search does not exist', async () => {
    const res = await t.gql(RUN, { id: 999 });
    expect(res.errors?.[0]?.message).toBe('Saved search 999 not found');
  });
});
