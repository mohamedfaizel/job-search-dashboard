import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const CREATE_JOB = `mutation ($input: CreateJobInput!) { createJob(input: $input) { id applicationStatus } }`;
const SET = `mutation ($id: ID!, $status: ApplicationStatus!) {
  updateJobStatus(id: $id, status: $status) { id applicationStatus }
}`;
const MINE = `query { myApplications { status updatedAt job { title applicationStatus } } }`;
const PAGE = `query ($filter: JobFilterInput) {
  jobsPage(filter: $filter) { items { title applicationStatus } }
}`;

interface Mine {
  myApplications: { status: string; job: { title: string; applicationStatus: string } }[];
}
interface Page {
  jobsPage: { items: { title: string; applicationStatus: string }[] };
}

describe('applications (tracker)', () => {
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
    await seedTestUsers(t.prisma);
    ids = {};
    for (const title of ['Frontend Engineer', 'Backend Engineer', 'Data Analyst']) {
      const res = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
        input: { title, companyName: 'Acme' },
      });
      ids[title] = res.data!.createJob.id;
    }
  });

  const statuses = async (as: TestApp['gql']) => {
    const res = await as<Page>(PAGE);
    return Object.fromEntries(
      res.data!.jobsPage.items.map((job) => [job.title, job.applicationStatus]),
    );
  };

  it('keeps each user’s status to themselves', async () => {
    await t.asUser(SET, { id: ids['Frontend Engineer'], status: 'APPLIED' });
    await t.gql(SET, { id: ids['Frontend Engineer'], status: 'REJECTED' });

    expect((await statuses(t.asUser))['Frontend Engineer']).toBe('APPLIED');
    expect((await statuses(t.gql))['Frontend Engineer']).toBe('REJECTED');
    expect((await statuses(t.asUser))['Data Analyst']).toBe('NONE');
  });

  it('lists your tracked jobs, most recently moved first', async () => {
    await t.asUser(SET, { id: ids['Frontend Engineer'], status: 'SAVED' });
    await t.asUser(SET, { id: ids['Backend Engineer'], status: 'INTERVIEWING' });
    await t.asUser(SET, { id: ids['Frontend Engineer'], status: 'APPLIED' });

    const res = await t.asUser<Mine>(MINE);

    expect(res.data!.myApplications).toMatchObject([
      { status: 'APPLIED', job: { title: 'Frontend Engineer', applicationStatus: 'APPLIED' } },
      { status: 'INTERVIEWING', job: { title: 'Backend Engineer' } },
    ]);
    expect((await t.gql<Mine>(MINE)).data!.myApplications).toEqual([]);
  });

  it('takes a job off the tracker when set back to Not applied', async () => {
    await t.asUser(SET, { id: ids['Data Analyst'], status: 'OFFER' });

    const res = await t.asUser(SET, { id: ids['Data Analyst'], status: 'NONE' });

    expect(res.data).toMatchObject({ updateJobStatus: { applicationStatus: 'NONE' } });
    expect((await t.asUser<Mine>(MINE)).data!.myApplications).toEqual([]);
    expect(await t.prisma.application.count()).toBe(0);
  });

  it('filters the table by your own status, including Not applied', async () => {
    await t.asUser(SET, { id: ids['Frontend Engineer'], status: 'APPLIED' });
    await t.gql(SET, { id: ids['Backend Engineer'], status: 'APPLIED' });

    const applied = await t.asUser<Page>(PAGE, { filter: { applicationStatuses: ['APPLIED'] } });
    expect(applied.data!.jobsPage.items.map((j) => j.title)).toEqual(['Frontend Engineer']);

    const notApplied = await t.asUser<Page>(PAGE, {
      filter: { applicationStatuses: ['NONE', 'APPLIED'] },
    });
    expect(notApplied.data!.jobsPage.items.map((j) => j.title).sort()).toEqual([
      'Backend Engineer',
      'Data Analyst',
      'Frontend Engineer',
    ]);
  });

  it('gives a status chosen when adding a job to the admin who added it', async () => {
    const res = await t.gql<{ createJob: { id: string; applicationStatus: string } }>(CREATE_JOB, {
      input: { title: 'Designer', companyName: 'Acme', applicationStatus: 'SAVED' },
    });

    expect(res.data!.createJob.applicationStatus).toBe('SAVED');
    expect((await statuses(t.asUser))['Designer']).toBe('NONE');
  });

  it('needs a login and an existing job', async () => {
    expect((await t.anonymous(MINE)).errors?.[0]?.message).toBe('Please log in');
    const missing = await t.asUser(SET, { id: 'nope', status: 'SAVED' });
    expect(missing.errors?.[0]?.message).toBe('Job nope not found');
  });
});
