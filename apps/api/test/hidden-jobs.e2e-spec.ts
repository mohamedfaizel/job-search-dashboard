import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const CREATE_JOB = `mutation ($input: CreateJobInput!) { createJob(input: $input) { id } }`;
const PAGE = `query ($filter: JobFilterInput) { jobsPage(filter: $filter) { total items { title } } }`;
const HIDE = `mutation ($id: ID!) { hideJob(id: $id) }`;
const UNHIDE = `mutation ($id: ID!) { unhideJob(id: $id) }`;
const COUNT = `query { hiddenJobCount }`;

interface Page {
  jobsPage: { total: number; items: { title: string }[] };
}

describe('hidden jobs', () => {
  let t: TestApp;
  let ids: Record<string, string>;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    // Hidden jobs belong to real users, so the minted sessions need matching rows.
    await seedTestUsers(t.prisma);
    ids = {};
    for (const title of ['Frontend Engineer', 'Backend Engineer', 'Data Analyst']) {
      const res = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
        input: { title, companyName: 'Acme' },
      });
      ids[title] = res.data!.createJob.id;
    }
  });

  const titles = async (as: TestApp['gql'], filter?: Record<string, unknown>) => {
    const res = await as<Page>(PAGE, { filter });
    return res.data!.jobsPage.items.map((job) => job.title).sort();
  };

  it('leaves hidden jobs out of your table and lists them on their own', async () => {
    const res = await t.asUser(HIDE, { id: ids['Data Analyst'] });
    expect(res.data).toEqual({ hideJob: true });

    expect(await titles(t.asUser)).toEqual(['Backend Engineer', 'Frontend Engineer']);
    expect(await titles(t.asUser, { hidden: true })).toEqual(['Data Analyst']);
    const page = await t.asUser<Page>(PAGE, {});
    expect(page.data!.jobsPage.total).toBe(2);
    expect((await t.asUser(COUNT)).data).toEqual({ hiddenJobCount: 1 });
  });

  it('only hides the job for the user who hid it', async () => {
    await t.asUser(HIDE, { id: ids['Data Analyst'] });

    expect(await titles(t.gql)).toHaveLength(3);
    expect((await t.gql(COUNT)).data).toEqual({ hiddenJobCount: 0 });
  });

  it('combines with the other filters', async () => {
    await t.asUser(HIDE, { id: ids['Frontend Engineer'] });

    expect(await titles(t.asUser, { search: 'engineer' })).toEqual(['Backend Engineer']);
    expect(await titles(t.asUser, { search: 'engineer', hidden: true })).toEqual([
      'Frontend Engineer',
    ]);
  });

  it('brings a job back, and hiding or unhiding twice is harmless', async () => {
    await t.asUser(HIDE, { id: ids['Data Analyst'] });
    await t.asUser(HIDE, { id: ids['Data Analyst'] });
    expect((await t.asUser(COUNT)).data).toEqual({ hiddenJobCount: 1 });

    await t.asUser(UNHIDE, { id: ids['Data Analyst'] });
    const again = await t.asUser(UNHIDE, { id: ids['Data Analyst'] });

    expect(again.data).toEqual({ unhideJob: true });
    expect(await titles(t.asUser)).toHaveLength(3);
    expect((await t.asUser(COUNT)).data).toEqual({ hiddenJobCount: 0 });
  });

  it('says when the job does not exist, and needs a login', async () => {
    const missing = await t.asUser(HIDE, { id: 'nope' });
    expect(missing.errors?.[0]?.message).toBe('Job nope not found');

    const anonymous = await t.anonymous(HIDE, { id: ids['Data Analyst'] });
    expect(anonymous.errors?.[0]?.message).toBe('Please log in');
  });
});
