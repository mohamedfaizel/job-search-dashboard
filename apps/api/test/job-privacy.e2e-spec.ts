import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

// Every call that takes one job's id must treat a job on someone else's list as "not found",
// so a job id seen elsewhere never shows its title, company or ad text.

const CREATE_JOB = /* GraphQL */ `
  mutation ($input: CreateJobInput!) {
    createJob(input: $input) {
      id
    }
  }
`;
const INSIGHTS = /* GraphQL */ `
  query ($jobId: ID!) {
    jobInsights(jobId: $jobId) {
      checkedAgainst
    }
  }
`;
const RESUME = /* GraphQL */ `
  query ($jobId: String!) {
    jobResumeBuild(jobId: $jobId) {
      doc
    }
  }
`;
const START_RESUME = /* GraphQL */ `
  mutation ($jobId: String!) {
    startJobResumeBuild(jobId: $jobId) {
      doc
    }
  }
`;
const SALARY = /* GraphQL */ `
  query ($jobId: ID!) {
    salaryResearch(jobId: $jobId) {
      expectation
    }
  }
`;
const ADD_TO_QUEUE = /* GraphQL */ `
  mutation ($jobIds: [ID!]!) {
    addToApplyQueue(jobIds: $jobIds) {
      jobId
    }
  }
`;

describe('One job by id: only your own', () => {
  let t: TestApp;
  let jobId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    // The admin adds a job; it is on the admin's list only.
    const res = await t.gql<{ createJob: { id: string } }>(CREATE_JOB, {
      input: { title: 'Secret Role', companyName: 'Hidden GmbH', description: 'Private ad text' },
    });
    jobId = res.data!.createJob.id;
  });

  it.each([
    ['jobInsights', INSIGHTS],
    ['jobResumeBuild', RESUME],
    ['startJobResumeBuild', START_RESUME],
    ['salaryResearch', SALARY],
  ])('%s: someone else’s job is not found', async (_name, query) => {
    const res = await t.asUser(query, { jobId });
    expect(res.data ?? null).toBeNull();
    expect(res.errors?.[0]?.extensions).toMatchObject({ apiCode: 'JOB_NOT_FOUND' });
    expect(JSON.stringify(res)).not.toMatch(/Secret Role|Hidden GmbH|Private ad text/);
  });

  it('jobInsights still works for the job on your own list', async () => {
    const res = await t.gql(INSIGHTS, { jobId });
    expect(res.errors).toBeUndefined();
  });

  it('addToApplyQueue skips someone else’s job, so the queue page never lists it', async () => {
    const res = await t.asUser<{ addToApplyQueue: { jobId: string }[] }>(ADD_TO_QUEUE, {
      jobIds: [jobId],
    });
    expect(res.data?.addToApplyQueue).toEqual([]);
    const page = await request(t.server).get('/apply-queue').set('Cookie', t.cookieFor('USER'));
    expect(page.text).not.toContain('Secret Role');
  });

  it('the Apply kit page for someone else’s job is not found', async () => {
    const res = await request(t.server)
      .get(`/apply-kit/${jobId}`)
      .set('Cookie', t.cookieFor('USER'));
    expect(res.status).toBe(404);
    expect(res.text).not.toMatch(/Secret Role|Hidden GmbH/);
  });
});
