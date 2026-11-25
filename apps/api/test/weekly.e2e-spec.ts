import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyService } from '../src/briefing/weekly.service';
import { FitService } from '../src/insights/fit.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const BELL = /* GraphQL */ `
  query {
    notifications {
      items {
        kind
        count
        jobs {
          id
          fit
        }
        weekly {
          applied
          replies
          interviews
          newJobs
          goodJobs
          best {
            id
            name
            jobs
            good
          }
          pause {
            id
            name
            jobs
            good
            runAt
          }
        }
      }
    }
  }
`;

interface Search {
  id: number;
  name: string;
  jobs: number;
  good: number;
  runAt?: string | null;
}
interface Bell {
  notifications: {
    items: {
      kind: string;
      count: number;
      jobs: { id: string; fit: number }[];
      weekly: {
        applied: number;
        replies: number;
        interviews: number;
        newJobs: number;
        goodJobs: number;
        best: Search | null;
        pause: Search | null;
      } | null;
    }[];
  };
}

const HOUR = 3_600_000;

describe('weekly report', () => {
  let t: TestApp;
  let weekly: WeeklyService;
  const pushed: { title: string; body: string }[] = [];
  const real = globalThis.fetch;
  const now = new Date();

  beforeAll(async () => {
    t = await createTestApp();
    weekly = t.app.get(WeeklyService);
    vi.spyOn(t.app.get(FitService), 'ensureFresh').mockResolvedValue();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    pushed.length = 0;
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    await t.prisma.pushToken.create({ data: { userId: 1, token: 'ExponentPushToken[w]' } });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes('exp.host')) return real(input, init);
      const messages = JSON.parse(typeof init?.body === 'string' ? init.body : '[]') as {
        title: string;
        body: string;
      }[];
      pushed.push(...messages);
      return Promise.resolve(
        Response.json({ data: messages.map(() => ({ status: 'ok', id: 'x' })) }),
      );
    });
  });
  afterEach(() => {
    vi.mocked(globalThis.fetch).mockRestore();
  });

  /** A saved search whose run `hoursAgo` added jobs with these Fit %s. */
  async function searchWithRun(
    name: string,
    schedule: 'OFF' | 'DAILY',
    hoursAgo: number,
    fits: number[],
  ) {
    const company = await t.prisma.company.upsert({
      where: { name: 'Acme' },
      create: { name: 'Acme' },
      update: {},
    });
    const search = await t.prisma.savedSearch.create({
      data: {
        userId: 1,
        name,
        titles: [name],
        skills: [],
        countryCodes: [],
        locations: [],
        schedule,
        runAt: '06:15',
      },
    });
    const startedAt = new Date(now.getTime() - hoursAgo * HOUR);
    const addedAt = new Date(startedAt.getTime() + 1000);
    await t.prisma.syncRun.create({
      data: {
        searchKey: name,
        input: {},
        startedAt,
        finishedAt: new Date(startedAt.getTime() + 60_000),
        complete: true,
        fetched: fits.length,
        created: fits.length,
        updated: 0,
        savedSearchId: search.id,
        userId: 1,
      },
    });
    for (const [i, fit] of fits.entries()) {
      await t.prisma.job.create({
        data: {
          id: `${name}-${String(i)}`,
          source: 'MANUAL',
          title: `${name} job ${String(i)}`,
          companyId: company.id,
          postedAt: addedAt,
          listedFor: { create: { userId: 1, addedAt } },
          fits: { create: { userId: 1, score: fit } },
        },
      });
    }
    return search;
  }

  it('sums up the week, names the best search and the one to pause', async () => {
    await t.prisma.profile.create({ data: { userId: 1, matchFitMin: 70 } });
    const best = await searchWithRun('Frontend', 'DAILY', 48, [90, 80, 40]);
    const noisy = await searchWithRun('Sales', 'DAILY', 24, [30, 20, 10, 50, 45, 35]);
    // An old run and its jobs don't count.
    await searchWithRun('Old', 'DAILY', 24 * 9, [95]);
    await t.prisma.applicationEvent.createMany({
      data: [
        { userId: 1, jobId: 'Frontend-0', status: 'APPLIED', at: new Date(now.getTime() - HOUR) },
        { userId: 1, jobId: 'Frontend-1', status: 'APPLIED', at: new Date(now.getTime() - HOUR) },
        {
          userId: 1,
          jobId: 'Frontend-0',
          status: 'INTERVIEWING',
          at: new Date(now.getTime() - HOUR),
        },
        { userId: 1, jobId: 'Frontend-1', status: 'REJECTED', at: new Date(now.getTime() - HOUR) },
        {
          userId: 1,
          jobId: 'Old-0',
          status: 'APPLIED',
          at: new Date(now.getTime() - 10 * 24 * HOUR),
        },
      ],
    });

    expect(await weekly.sendAll(now)).toBe(1);

    const { data } = await t.gql<Bell>(BELL);
    const item = data?.notifications.items[0];
    expect(item?.kind).toBe('WEEKLY_REPORT');
    expect(item?.count).toBe(2);
    expect(item?.jobs.map((j) => j.id)).toEqual(['Frontend-0', 'Frontend-1']);
    expect(item?.weekly).toEqual({
      applied: 2,
      replies: 2,
      interviews: 1,
      newJobs: 9,
      goodJobs: 2,
      best: { id: best.id, name: 'Frontend', jobs: 3, good: 2 },
      pause: { id: noisy.id, name: 'Sales', jobs: 6, good: 0, runAt: '06:15' },
    });
    expect(pushed).toEqual([
      expect.objectContaining({
        title: 'Your week: 2 applied, 2 replies, 2 good jobs',
        body: 'Best search: Frontend (2 good)\nPause "Sales"? No good jobs this week',
      }),
    ]);
  });

  it('does not ask to pause a search that is already off, or one you hid good jobs from', async () => {
    await t.prisma.profile.create({ data: { userId: 1, matchFitMin: 70 } });
    await searchWithRun('Manual', 'OFF', 24, [10, 10, 10, 10, 10]);

    expect(await weekly.sendAll(now)).toBe(1);
    const { data } = await t.gql<Bell>(BELL);
    expect(data?.notifications.items[0]?.weekly).toMatchObject({
      newJobs: 5,
      goodJobs: 0,
      best: null,
      pause: null,
    });
  });

  it('counts a hidden job as not good', async () => {
    await t.prisma.profile.create({ data: { userId: 1, matchFitMin: 70 } });
    await searchWithRun('Backend', 'DAILY', 24, [95]);
    await t.prisma.hiddenJob.create({ data: { userId: 1, jobId: 'Backend-0' } });

    await weekly.sendAll(now);
    const { data } = await t.gql<Bell>(BELL);
    expect(data?.notifications.items[0]?.weekly).toMatchObject({ newJobs: 1, goodJobs: 0 });
  });

  it('sends nothing after a quiet week, or when it is off', async () => {
    await t.prisma.profile.create({ data: { userId: 1 } });
    expect(await weekly.sendAll(now)).toBe(0);

    await searchWithRun('Frontend', 'DAILY', 24, [90]);
    const off = await t.gql(`mutation { setWeeklyReport(on: false) }`);
    expect(off.data).toEqual({ setWeeklyReport: true });
    expect(await weekly.sendAll(now)).toBe(0);

    const profile = await t.gql<{ myProfile: { weeklyReport: boolean } }>(
      `query { myProfile { weeklyReport } }`,
    );
    expect(profile.data?.myProfile.weeklyReport).toBe(false);
    expect(pushed).toEqual([]);
  });

  it('sends a missed Sunday once, when the app runs again', async () => {
    // Last sent 8 days ago: at least one Sunday 18:00 has passed since.
    const before = new Date(now.getTime() - 8 * 24 * HOUR);
    await t.prisma.profile.create({ data: { userId: 1, weeklySentAt: before } });
    await searchWithRun('Frontend', 'DAILY', 24, [90]);

    expect(await weekly.sendDue(now)).toBe(1);
    expect(await weekly.sendDue(now)).toBe(0);
  });

  it('skips the Sunday run when the scheduler is off, and keeps going when a user fails', async () => {
    const prev = process.env['SCHEDULER_ENABLED'];
    process.env['SCHEDULER_ENABLED'] = 'false';
    const spy = vi.spyOn(weekly, 'sendDue');
    await weekly.tick();
    expect(spy).not.toHaveBeenCalled();
    process.env['SCHEDULER_ENABLED'] = 'true';
    await weekly.tick();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    process.env['SCHEDULER_ENABLED'] = prev;

    await t.prisma.profile.create({ data: { userId: 1 } });
    await t.prisma.profile.create({ data: { userId: 2 } });
    await searchWithRun('Frontend', 'DAILY', 24, [90]);
    vi.spyOn(t.prisma.applicationEvent, 'findMany').mockRejectedValueOnce(new Error('boom'));
    expect(await weekly.sendAll(now)).toBe(0);
  });
});
