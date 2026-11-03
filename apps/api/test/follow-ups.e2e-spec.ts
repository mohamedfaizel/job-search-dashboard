import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const SET = `mutation ($id: ID!, $status: ApplicationStatus!) {
  updateJobStatus(id: $id, status: $status) { id }
}`;
const MINE = `query { myApplications { status updatedAt followedUpAt followUpDue job { id } } }`;
const FOLLOWED_UP = `mutation ($jobId: ID!) {
  markFollowedUp(jobId: $jobId) { followUpDue followedUpAt job { id } }
}`;

interface Row {
  status: string;
  updatedAt: string;
  followedUpAt: string | null;
  followUpDue: boolean;
  job: { id: string };
}

const DAY = 24 * 60 * 60 * 1000;

describe('follow-up reminders', () => {
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
    const job = await t.prisma.job.create({
      data: {
        title: 'Frontend developer',
        source: 'MANUAL',
        postedAt: new Date(),
        company: { create: { name: 'Acme' } },
      },
    });
    jobId = job.id;
  });

  const mine = async () => (await t.asUser<{ myApplications: Row[] }>(MINE)).data!.myApplications;
  const applied = (daysAgo: number) =>
    t.prisma.application.update({
      where: { userId_jobId: { userId: 2, jobId } },
      data: { statusChangedAt: new Date(Date.now() - daysAgo * DAY) },
    });

  it('asks to follow up after a week in Applied with no news', async () => {
    await t.asUser(SET, { id: jobId, status: 'APPLIED' });
    expect((await mine())[0]?.followUpDue).toBe(false);

    await applied(8);
    expect((await mine())[0]?.followUpDue).toBe(true);
  });

  it('stops asking for a week once you followed up, without moving the card date', async () => {
    await t.asUser(SET, { id: jobId, status: 'APPLIED' });
    await applied(8);
    const before = (await mine())[0]!.updatedAt;

    const res = await t.asUser<{ markFollowedUp: Row[] }>(FOLLOWED_UP, { jobId });

    expect(res.errors).toBeUndefined();
    expect(res.data!.markFollowedUp[0]).toMatchObject({ followUpDue: false, job: { id: jobId } });
    expect(res.data!.markFollowedUp[0]?.followedUpAt).not.toBeNull();
    expect((await mine())[0]?.updatedAt).toBe(before);
  });

  it('choosing Applied again does not restart the clock', async () => {
    await t.asUser(SET, { id: jobId, status: 'APPLIED' });
    await applied(8);
    await t.asUser(SET, { id: jobId, status: 'APPLIED' });
    expect((await mine())[0]?.followUpDue).toBe(true);
  });

  it('refuses a job that is not on your tracker', async () => {
    const res = await t.asUser(FOLLOWED_UP, { jobId });
    expect(res.errors?.[0]?.extensions?.['code']).toBeDefined();
  });
});
