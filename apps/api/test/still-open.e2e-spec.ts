import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchedPage } from '../src/liveness/judge';
import { LivenessService } from '../src/liveness/liveness.service';
import { PageFetcher } from '../src/liveness/page-fetcher';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const CHECK = /* GraphQL */ `
  mutation ($id: ID!) {
    checkJobStillOpen(id: $id) {
      id
      postingStatus
      lastCheck
      checkReason
      checkedAt
    }
  }
`;

const OPEN_PAGE = `<html><body><h1>Frontend developer</h1>${'<p>Join our team and build things. </p>'.repeat(20)}</body></html>`;

describe('still-open check', () => {
  let t: TestApp;
  let liveness: LivenessService;
  /** What the fake job sites answer, by link. */
  let pages: Record<string, Partial<FetchedPage>>;

  beforeAll(async () => {
    t = await createTestApp();
    liveness = t.app.get(LivenessService);
    vi.spyOn(t.app.get(PageFetcher), 'get').mockImplementation((url: string) => {
      const answer = pages[url];
      if (!answer) return Promise.reject(new Error('unreachable'));
      return Promise.resolve({ status: 200, url, finalUrl: url, body: OPEN_PAGE, ...answer });
    });
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    pages = {};
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  async function job(url: string | null, postedAt = new Date('2026-10-30')) {
    return t.prisma.job.create({
      data: {
        title: 'Frontend developer',
        source: 'MANUAL',
        url,
        postedAt,
        company: { connectOrCreate: { where: { name: 'Acme' }, create: { name: 'Acme' } } },
      },
    });
  }

  it('marks a job whose page is gone as expired', async () => {
    const { id } = await job('https://jobs.example.com/1');
    pages['https://jobs.example.com/1'] = { status: 404 };

    const res = await t.asUser<{ checkJobStillOpen: Record<string, unknown> }>(CHECK, { id });

    expect(res.errors).toBeUndefined();
    expect(res.data?.checkJobStillOpen).toMatchObject({
      postingStatus: 'expired',
      lastCheck: 'CLOSED',
      checkReason: 'NOT_FOUND',
    });
    expect((await t.prisma.job.findUniqueOrThrow({ where: { id } })).expiredAt).not.toBeNull();
  });

  it('keeps an open job active, and leaves the status alone when unsure', async () => {
    const open = await job('https://jobs.example.com/open');
    pages['https://jobs.example.com/open'] = {};
    const blocked = await job('https://jobs.example.com/blocked');
    pages['https://jobs.example.com/blocked'] = { status: 403 };

    const a = await t.gql<{ checkJobStillOpen: Record<string, unknown> }>(CHECK, { id: open.id });
    const b = await t.gql<{ checkJobStillOpen: Record<string, unknown> }>(CHECK, {
      id: blocked.id,
    });

    expect(a.data?.checkJobStillOpen).toMatchObject({ postingStatus: 'active', lastCheck: 'OPEN' });
    expect(b.data?.checkJobStillOpen).toMatchObject({
      postingStatus: 'active',
      lastCheck: 'UNKNOWN',
      checkReason: 'BLOCKED',
    });
  });

  it('says NO_LINK for a job without a link', async () => {
    const { id } = await job(null);
    const res = await t.gql<{ checkJobStillOpen: Record<string, unknown> }>(CHECK, { id });
    expect(res.data?.checkJobStillOpen).toMatchObject({
      lastCheck: 'UNKNOWN',
      checkReason: 'NO_LINK',
    });
  });

  it('reopens a job that turns out to be open again', async () => {
    const { id } = await job('https://jobs.example.com/back');
    pages['https://jobs.example.com/back'] = { status: 404 };
    await liveness.check(id, new Date('2026-11-01T10:00:00Z'));
    pages['https://jobs.example.com/back'] = {};
    await liveness.check(id, new Date('2026-11-02T10:00:00Z'));

    const row = await t.prisma.job.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ postingStatus: 'active', lastCheck: 'OPEN', expiredAt: null });
  });

  it('nightly: checks saved jobs first and skips expired or recently checked ones', async () => {
    const now = new Date('2026-11-03T03:00:00Z');
    const saved = await job('https://jobs.example.com/saved', new Date('2026-09-01'));
    await t.prisma.application.create({ data: { userId: 2, jobId: saved.id, status: 'SAVED' } });
    const newest = await job('https://jobs.example.com/newest', new Date('2026-11-02'));
    const older = await job('https://jobs.example.com/older', new Date('2026-10-01'));
    const recent = await job('https://jobs.example.com/recent');
    await t.prisma.job.update({
      where: { id: recent.id },
      data: { checkedAt: new Date('2026-11-03T01:00:00Z') },
    });
    const expired = await job('https://jobs.example.com/expired');
    await t.prisma.job.update({ where: { id: expired.id }, data: { postingStatus: 'expired' } });
    pages['https://jobs.example.com/saved'] = { status: 410 };
    pages['https://jobs.example.com/newest'] = {};

    // Room for two: the saved job comes first even though it is the oldest, then the newest.
    const counts = await liveness.checkDue(now, 2, 0);

    expect(counts).toEqual({ checked: 2, closed: 1, unknown: 0 });
    const rows = await t.prisma.job.findMany({
      select: { id: true, checkedAt: true, postingStatus: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(saved.id)?.postingStatus).toBe('expired');
    expect(byId.get(newest.id)?.checkedAt).toEqual(now);
    expect(byId.get(older.id)?.checkedAt).toBeNull();
    expect(byId.get(expired.id)?.checkedAt).toBeNull();
  });
});
