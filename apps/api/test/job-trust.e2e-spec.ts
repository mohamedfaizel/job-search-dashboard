import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const TRUST = /* GraphQL */ `
  query ($id: ID!) {
    jobTrust(id: $id) {
      level
      flags
      reposts
      firstPostedAt
      ageDays
    }
  }
`;

describe('job trust check', () => {
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

  const job = (
    title: string,
    postedAt: Date,
    description: string | null = null,
    company = 'Acme',
  ) =>
    t.prisma.job.create({
      data: {
        title,
        source: 'MANUAL',
        postedAt,
        description,
        company: { connectOrCreate: { where: { name: company }, create: { name: company } } },
      },
    });

  it('finds reposts at the same company and scam signs in the text', async () => {
    const day = 24 * 60 * 60 * 1000;
    const today = Date.now();
    await job('Data Analyst', new Date(today - 100 * day));
    await job('Data Analyst', new Date(today - 50 * day), null, 'Other Co');
    await job('Data Engineer', new Date(today - 30 * day));
    const latest = await job(
      'Data Analyst (m/w/d)',
      new Date(today - 2 * day),
      'Apply only via WhatsApp. ' +
        'We build dashboards and data tools for our customers. '.repeat(8),
    );
    const res = await t.asUser<{ jobTrust: Record<string, unknown> }>(TRUST, { id: latest.id });
    expect(res.errors).toBeUndefined();
    expect(res.data!.jobTrust).toMatchObject({
      level: 'WARNING',
      flags: ['CHAT_APP_ONLY', 'REPOSTED'],
      reposts: 1,
      ageDays: 2,
    });
  });

  it('needs a login and an existing job', async () => {
    expect((await t.anonymous(TRUST, { id: 'x' })).errors?.[0]?.message).toBe('Please log in');
    expect((await t.asUser(TRUST, { id: 'nope' })).errors?.[0]?.message).toBe('Job nope not found');
  });
});
