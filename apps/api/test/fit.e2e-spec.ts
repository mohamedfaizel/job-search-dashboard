import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const CREATE_JOB = /* GraphQL */ `
  mutation CreateJob($input: CreateJobInput!) {
    createJob(input: $input) {
      id
    }
  }
`;

const JOBS = /* GraphQL */ `
  query Jobs($filter: JobFilterInput, $sort: JobSortInput, $page: Int!, $pageSize: Int!) {
    jobsPage(filter: $filter, sort: $sort, page: $page, pageSize: $pageSize) {
      total
      items {
        title
        fitScore
      }
    }
  }
`;

const INSIGHTS = /* GraphQL */ `
  query JobInsights($jobId: ID!) {
    jobInsights(jobId: $jobId) {
      score
    }
  }
`;

const REMOVE = /* GraphQL */ `
  mutation Remove($jobId: ID!, $term: String!) {
    removeInsightTerm(jobId: $jobId, term: $term) {
      score
    }
  }
`;

const RECALCULATE = /* GraphQL */ `
  mutation {
    recalculateFit
  }
`;

interface Page {
  total: number;
  items: { title: string; fitScore: number | null }[];
}

describe('Fit % for every job', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  async function addJob(title: string, skills: string[], description: string) {
    const res = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: { companyName: 'Acme', title, skills, description },
    });
    expect(res.errors).toBeUndefined();
    return res.data!.createJob.id;
  }
  async function jobs(variables: Record<string, unknown> = {}) {
    const res = await t.asUser<{ jobsPage: Page }>(JOBS, { page: 1, pageSize: 25, ...variables });
    expect(res.errors).toBeUndefined();
    return res.data!.jobsPage;
  }
  const byFit = { sort: { field: 'FIT', direction: 'DESC' } };

  async function threeJobs() {
    const backend = await addJob(
      'Backend Engineer',
      ['node.js', 'postgresql'],
      'Build Node.js services on PostgreSQL. Docker and Kubernetes in production.',
    );
    const frontend = await addJob(
      'Frontend Engineer',
      ['react', 'typescript'],
      'Build React apps in TypeScript with a design system.',
    );
    const data = await addJob(
      'Data Scientist',
      ['python', 'spark'],
      'Train models in Python and Spark. Statistics background.',
    );
    return { backend, frontend, data };
  }

  it('shows no Fit until you have a resume', async () => {
    await threeJobs();
    const page = await jobs(byFit);
    expect(page.total).toBe(3);
    expect(page.items.every((job) => job.fitScore === null)).toBe(true);
  });

  it('sorts by Fit, best first, with the same score as the job popup', async () => {
    const { backend } = await threeJobs();
    await t.prisma.profile.create({
      data: {
        userId: 2,
        resumeText: 'Backend Engineer. Node.js, PostgreSQL, Docker and Kubernetes. Some React.',
      },
    });

    const page = await jobs(byFit);
    expect(page.items.map((job) => job.title)).toEqual([
      'Backend Engineer',
      'Frontend Engineer',
      'Data Scientist',
    ]);
    const scores = page.items.map((job) => job.fitScore ?? -1);
    expect(scores[0]).toBeGreaterThan(scores[1]!);
    expect(scores[1]).toBeGreaterThan(scores[2]!);

    const popup = await t.asUser<{ jobInsights: { score: number } }>(INSIGHTS, {
      jobId: backend,
    });
    expect(popup.data!.jobInsights.score).toBe(scores[0]);

    const lowest = await jobs({ sort: { field: 'FIT', direction: 'ASC' } });
    expect(lowest.items[0]!.title).toBe('Data Scientist');

    // Other users get their own scores: the admin has no resume.
    const admin = await t.gql<{ jobsPage: Page }>(JOBS, { page: 1, pageSize: 25, ...byFit });
    expect(admin.data!.jobsPage.items.every((job) => job.fitScore === null)).toBe(true);
  });

  it('filters by a minimum Fit and pages through the sorted jobs', async () => {
    await threeJobs();
    await t.prisma.profile.create({
      data: { userId: 2, resumeText: 'Backend Engineer. Node.js, PostgreSQL, Docker, Kubernetes.' },
    });
    const best = (await jobs(byFit)).items[0]!;

    const filtered = await jobs({ ...byFit, filter: { minFit: best.fitScore } });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]!.title).toBe('Backend Engineer');

    const second = await jobs({ ...byFit, page: 2, pageSize: 1 });
    expect(second.total).toBe(3);
    expect(second.items.map((job) => job.title)).toEqual(['Frontend Engineer']);
  });

  it('works the scores out again when the resume, removed terms or jobs change', async () => {
    const { data } = await threeJobs();
    await t.prisma.profile.create({ data: { userId: 2, resumeText: 'Python and statistics.' } });
    const before = (await jobs(byFit)).items[0]!;
    expect(before.title).toBe('Data Scientist');

    // Removing a term you don't have ("spark") raises that job's Fit.
    const removed = await t.asUser<{ removeInsightTerm: { score: number } }>(REMOVE, {
      jobId: data,
      term: 'spark',
    });
    const after = (await jobs(byFit)).items[0]!;
    expect(after.fitScore).toBeGreaterThan(before.fitScore!);
    expect(after.fitScore).toBe(removed.data!.removeInsightTerm.score);

    // A new resume changes the order.
    await t.prisma.profile.update({
      where: { userId: 2 },
      data: { resumeText: 'Frontend Engineer: React and TypeScript, design systems.' },
    });
    expect((await jobs(byFit)).items[0]!.title).toBe('Frontend Engineer');

    // A new job gets a score too.
    await addJob('React Developer', ['react'], 'React and TypeScript.');
    const page = await jobs(byFit);
    expect(page.items.find((job) => job.title === 'React Developer')?.fitScore).not.toBeNull();

    const recalculated = await t.asUser<{ recalculateFit: number }>(RECALCULATE);
    expect(recalculated.data!.recalculateFit).toBe(4);
  });
});
