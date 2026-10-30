import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobsService } from '../src/jobs/jobs.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const START_VISIT = /* GraphQL */ `
  mutation {
    startJobsVisit
  }
`;

const JOBS = /* GraphQL */ `
  query Jobs($filter: JobFilterInput) {
    jobsPage(filter: $filter, page: 1, pageSize: 25) {
      total
      items {
        title
        createdAt
      }
    }
  }
`;

const CREATE_JOB = /* GraphQL */ `
  mutation CreateJob($input: CreateJobInput!) {
    createJob(input: $input) {
      id
    }
  }
`;

const MINUTE = 60 * 1000;

describe('New since your last visit', () => {
  let t: TestApp;
  let jobs: JobsService;

  beforeAll(async () => {
    t = await createTestApp();
    jobs = t.app.get(JobsService);
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  it('marks nothing New on your first visit', async () => {
    const res = await t.asUser<{ startJobsVisit: string | null }>(START_VISIT);
    expect(res.errors).toBeUndefined();
    expect(res.data!.startJobsVisit).toBeNull();
  });

  it('keeps the same time for the whole visit, and moves it on the next one', async () => {
    const nine = new Date('2026-10-30T09:00:00Z');
    expect(await jobs.startJobsVisit(2, nine)).toBeNull();

    // A reload 20 minutes later is the same visit (the first visit still has nothing New).
    expect(await jobs.startJobsVisit(2, new Date(nine.getTime() + 20 * MINUTE))).toBeNull();
    // ...and so is one 20 minutes after that: the gap counts from the last time you looked.
    const nineForty = new Date(nine.getTime() + 40 * MINUTE);
    expect(await jobs.startJobsVisit(2, nineForty)).toBeNull();

    // Back in the evening: jobs since you last looked are New, all visit long.
    const evening = new Date('2026-10-30T18:00:00Z');
    expect(await jobs.startJobsVisit(2, evening)).toEqual(nineForty);
    expect(await jobs.startJobsVisit(2, new Date(evening.getTime() + 10 * MINUTE))).toEqual(
      nineForty,
    );

    // Another user's visits are their own.
    expect(await jobs.startJobsVisit(1, evening)).toBeNull();
  });

  it('lists only the jobs added after a time', async () => {
    const add = (title: string) =>
      t.gql(CREATE_JOB, { input: { companyName: 'Acme', title, description: 'React.' } });
    await add('Old job');
    const before = new Date();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await add('New job');

    const res = await t.asUser<{ jobsPage: { total: number; items: { title: string }[] } }>(JOBS, {
      filter: { createdAfter: before.toISOString() },
    });
    expect(res.errors).toBeUndefined();
    expect(res.data!.jobsPage.total).toBe(1);
    expect(res.data!.jobsPage.items[0]!.title).toBe('New job');
  });
});
