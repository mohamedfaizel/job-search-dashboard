import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobsService } from '../src/jobs/jobs.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const CREATE_JOB = /* GraphQL */ `
  mutation CreateJob($input: CreateJobInput!) {
    createJob(input: $input) {
      id
      title
      source
      applicationStatus
      company {
        name
      }
    }
  }
`;

const JOBS_PAGE = /* GraphQL */ `
  query JobsPage($filter: JobFilterInput, $sort: JobSortInput, $page: Int, $pageSize: Int) {
    jobsPage(filter: $filter, sort: $sort, page: $page, pageSize: $pageSize) {
      total
      page
      pageSize
      items {
        title
        salaryMaxUsd
        company {
          name
        }
      }
    }
  }
`;

interface JobsPageData {
  jobsPage: { total: number; items: { title: string; salaryMaxUsd: number | null }[] };
}

describe('Jobs GraphQL API', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    // Statuses belong to real users, so the minted sessions need matching rows.
    await seedTestUsers(t.prisma);
  });

  async function addJob(input: Record<string, unknown>) {
    const res = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, { input });
    expect(res.errors).toBeUndefined();
    return res.data!.createJob.id;
  }

  it('adds a job by hand', async () => {
    const res = await t.gql(CREATE_JOB, {
      input: { title: 'Frontend Engineer', companyName: 'Acme', skills: ['react'] },
    });
    expect(res.data).toEqual({
      createJob: {
        id: expect.any(String),
        title: 'Frontend Engineer',
        source: 'MANUAL',
        applicationStatus: 'NONE',
        company: { name: 'Acme' },
      },
    });
  });

  it('rejects invalid input with a readable message', async () => {
    const res = await t.gql(CREATE_JOB, {
      input: { title: '', companyName: 'Acme', url: 'not a url' },
    });
    expect(res.errors?.[0]?.message).toContain('title should not be empty');
    expect(res.errors?.[0]?.message).toContain('url must be a URL address');
  });

  it('rejects a minimum salary above the maximum', async () => {
    const res = await t.gql(CREATE_JOB, {
      input: { title: 'Dev', companyName: 'Acme', salaryMinUsd: 200_000, salaryMaxUsd: 100_000 },
    });
    expect(res.errors?.[0]?.message).toContain('salaryMinUsd cannot be greater');
  });

  it('filters by search text, skills and workplace', async () => {
    await addJob({
      title: 'React Developer',
      companyName: 'Acme',
      skills: ['react'],
      workplace: 'REMOTE',
    });
    await addJob({
      title: 'Vue Developer',
      companyName: 'Beta',
      skills: ['vue'],
      workplace: 'REMOTE',
    });
    await addJob({
      title: 'React Native Dev',
      companyName: 'Gamma',
      skills: ['react'],
      workplace: 'ONSITE',
    });

    const res = await t.gql<JobsPageData>(JOBS_PAGE, {
      filter: { search: 'developer', skills: ['react'], workplaces: ['REMOTE'] },
    });
    expect(res.data?.jobsPage.total).toBe(1);
    expect(res.data?.jobsPage.items[0]?.title).toBe('React Developer');
  });

  it('sorts by salary with missing salaries last', async () => {
    await addJob({ title: 'Low', companyName: 'A', salaryMaxUsd: 50_000 });
    await addJob({ title: 'None', companyName: 'B' });
    await addJob({ title: 'High', companyName: 'C', salaryMaxUsd: 200_000 });

    const desc = await t.gql<JobsPageData>(JOBS_PAGE, {
      sort: { field: 'SALARY', direction: 'DESC' },
    });
    expect(desc.data?.jobsPage.items.map((j) => j.title)).toEqual(['High', 'Low', 'None']);

    const asc = await t.gql<JobsPageData>(JOBS_PAGE, {
      sort: { field: 'SALARY', direction: 'ASC' },
    });
    expect(asc.data?.jobsPage.items.map((j) => j.title)).toEqual(['Low', 'High', 'None']);
  });

  it('paginates', async () => {
    for (const title of ['A', 'B', 'C']) await addJob({ title, companyName: 'Acme' });

    const res = await t.gql<JobsPageData>(JOBS_PAGE, {
      sort: { field: 'TITLE', direction: 'ASC' },
      page: 2,
      pageSize: 2,
    });
    expect(res.data?.jobsPage.total).toBe(3);
    expect(res.data?.jobsPage.items.map((j) => j.title)).toEqual(['C']);
  });

  it('updates the application status', async () => {
    const id = await addJob({ title: 'Dev', companyName: 'Acme' });
    const res = await t.gql<{ updateJobStatus: { applicationStatus: string } }>(
      `mutation ($id: ID!) { updateJobStatus(id: $id, status: APPLIED) { applicationStatus } }`,
      { id },
    );
    expect(res.data?.updateJobStatus.applicationStatus).toBe('APPLIED');

    const missing = await t.gql(`mutation { updateJobStatus(id: "nope", status: APPLIED) { id } }`);
    expect(missing.errors?.[0]?.message).toContain('not found');
  });

  it('lists distinct values for the column filters', async () => {
    await addJob({
      title: 'A',
      companyName: 'Acme',
      skills: ['react', 'node'],
      city: 'Berlin',
      language: 'DE',
    });
    await addJob({ title: 'B', companyName: 'Beta', skills: ['react'], city: 'Aachen' });

    const res = await t.gql<{ jobFilterOptions: Record<string, string[]> }>(
      `{ jobFilterOptions { companies skills cities languages } }`,
    );
    expect(res.data?.jobFilterOptions).toEqual({
      companies: ['Acme', 'Beta'],
      skills: ['node', 'react'],
      cities: ['Aachen', 'Berlin'],
      // Stored in lower case, the way JobsPipe sends it.
      languages: ['de'],
    });
  });

  it('filters by country and language', async () => {
    await addJob({ title: 'Berlin job', companyName: 'Acme', countryCode: 'de', language: 'de' });
    await addJob({
      title: 'Berlin, English ad',
      companyName: 'Acme',
      countryCode: 'DE',
      language: 'en',
    });
    await addJob({ title: 'London job', companyName: 'Beta', countryCode: 'GB', language: 'en' });

    const res = await t.gql<JobsPageData>(JOBS_PAGE, {
      filter: { countryCodes: ['DE'], languages: ['en'] },
    });
    expect(res.errors).toBeUndefined();
    expect(res.data?.jobsPage.items.map((job) => job.title)).toEqual(['Berlin, English ad']);
  });

  it('tags visa sponsorship from the description and filters by it', async () => {
    await addJob({
      title: 'Sponsors',
      companyName: 'Acme',
      description: 'We offer visa sponsorship and relocation support.',
    });
    await addJob({
      title: 'Says no',
      companyName: 'Beta',
      description: 'We cannot sponsor visas for this role.',
    });
    await addJob({ title: 'Silent', companyName: 'Gamma', description: 'Build React apps.' });

    const res = await t.gql<{ jobsPage: { items: { title: string; visa: string }[] } }>(
      `query { jobsPage(filter: { visas: [OFFERS, NOT_STATED] }, sort: { field: TITLE, direction: ASC }) { items { title visa } } }`,
    );
    expect(res.errors).toBeUndefined();
    expect(res.data?.jobsPage.items).toEqual([
      { title: 'Silent', visa: 'NOT_STATED' },
      { title: 'Sponsors', visa: 'OFFERS' },
    ]);
  });

  it('tags jobs saved before the visa tag existed', async () => {
    const id = await addJob({
      title: 'Old job',
      companyName: 'Acme',
      description: 'Visa sponsorship available.',
    });
    await t.prisma.job.update({ where: { id }, data: { visa: null } });

    const jobs = t.app.get(JobsService);
    expect(await jobs.backfillVisa()).toBe(1);
    expect((await t.prisma.job.findUniqueOrThrow({ where: { id } })).visa).toBe('OFFERS');
  });
});
