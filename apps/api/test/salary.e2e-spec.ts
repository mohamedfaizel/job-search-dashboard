import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, listAllJobsFor, resetDatabase, seedTestUsers } from './helpers';

const RESEARCH = /* GraphQL */ `
  query ($jobId: ID!) {
    salaryResearch(jobId: $jobId) {
      currency
      basis
      sampleSize
      median
      jobMax
      ask
      examples {
        title
        company
      }
      expectation
      prompt
    }
  }
`;

describe('salary research', () => {
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

  const job = (title: string, countryCode: string, min: number | null, max: number | null) =>
    t.prisma.job.create({
      data: {
        title,
        source: 'MANUAL',
        postedAt: new Date(),
        countryCode,
        salaryMinUsd: min,
        salaryMaxUsd: max,
        company: { connectOrCreate: { where: { name: 'Acme' }, create: { name: 'Acme' } } },
      },
    });

  it('ranges similar jobs in the same country and builds the prompt with your expectation', async () => {
    const mine = await job('Data Analyst (m/w/d)', 'DE', null, 75600);
    await job('Junior Data Analyst', 'DE', 54000, 54000);
    await job('Data Analyst', 'DE', 75600, 75600);
    await job('Data Analyst', 'US', 200000, 200000);
    await job('Data Analyst', 'DE', null, null);
    await t.prisma.profile.create({ data: { userId: 2, salaryExpectation: '65.000 €' } });
    await listAllJobsFor(t.prisma, 2);

    const res = await t.asUser<{ salaryResearch: Record<string, unknown> }>(RESEARCH, {
      jobId: mine.id,
    });
    expect(res.errors).toBeUndefined();
    expect(res.data!.salaryResearch).toMatchObject({
      currency: 'EUR',
      basis: 'TITLE',
      sampleSize: 2,
      median: 60000,
      jobMax: 70000,
      ask: 70000,
      expectation: '65.000 €',
    });
    expect(res.data!.salaryResearch['prompt']).toContain('My salary expectation so far: 65.000 €');
  });

  it('needs a login and an existing job', async () => {
    expect((await t.anonymous(RESEARCH, { jobId: 'x' })).errors?.[0]?.message).toBe(
      'Please log in',
    );
    expect((await t.asUser(RESEARCH, { jobId: 'nope' })).errors?.[0]?.message).toBe(
      'Job nope not found',
    );
  });
});
