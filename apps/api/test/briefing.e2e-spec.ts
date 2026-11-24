import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BriefingService } from '../src/briefing/briefing.service';
import { FitService } from '../src/insights/fit.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const TOKEN = 'ExponentPushToken[abc123]';

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
        briefing {
          newJobs
          kits
          followUps
          interviews
          replies
        }
      }
    }
  }
`;

interface Bell {
  notifications: {
    items: {
      kind: string;
      count: number;
      jobs: { id: string; fit: number }[];
      briefing: Record<string, number> | null;
    }[];
  };
}

describe('morning briefing', () => {
  let t: TestApp;
  let briefing: BriefingService;
  const pushed: unknown[] = [];
  const real = globalThis.fetch;

  beforeAll(async () => {
    t = await createTestApp();
    briefing = t.app.get(BriefingService);
    vi.spyOn(t.app.get(FitService), 'ensureFresh').mockResolvedValue();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    pushed.length = 0;
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes('exp.host')) return real(input, init);
      const messages = JSON.parse(typeof init?.body === 'string' ? init.body : '[]') as unknown[];
      pushed.push(...messages);
      return Promise.resolve(
        Response.json({ data: messages.map(() => ({ status: 'ok', id: 'x' })) }),
      );
    });
  });
  afterEach(() => {
    vi.mocked(globalThis.fetch).mockRestore();
  });

  /** 07:45 today: after the default 07:30. */
  const morning = () => {
    const d = new Date();
    d.setHours(7, 45, 0, 0);
    return d;
  };

  async function goodJob(id: string, fit: number) {
    const company = await t.prisma.company.upsert({
      where: { name: 'Acme' },
      create: { name: 'Acme' },
      update: {},
    });
    await t.prisma.job.create({
      data: {
        id,
        source: 'MANUAL',
        title: `Job ${id}`,
        companyId: company.id,
        postedAt: new Date(),
        listedFor: { create: { userId: 1, addedAt: new Date(morning().getTime() - 3_600_000) } },
        fits: { create: { userId: 1, score: fit } },
      },
    });
  }

  it('sends one briefing a day to the bell and the phone', async () => {
    await t.prisma.profile.create({ data: { userId: 1, matchFitMin: 70 } });
    await goodJob('a', 90);
    await goodJob('b', 75);
    await goodJob('c', 40);
    await t.prisma.application.create({
      data: {
        userId: 1,
        jobId: 'c',
        status: 'APPLIED',
        statusChangedAt: new Date(Date.now() - 10 * 86_400_000),
      },
    });
    const reg = await t.gql(`mutation ($t: String!) { registerPushToken(token: $t) }`, {
      t: TOKEN,
    });
    expect(reg.data).toEqual({ registerPushToken: true });

    expect(await briefing.sendDue(morning())).toBe(1);
    expect(await briefing.sendDue(new Date(morning().getTime() + 60_000))).toBe(0);

    const bell = await t.gql<Bell>(BELL);
    expect(bell.data!.notifications.items[0]).toMatchObject({
      kind: 'BRIEFING',
      count: 2,
      jobs: [
        { id: 'a', fit: 90 },
        { id: 'b', fit: 75 },
      ],
      briefing: { newJobs: 2, kits: 0, followUps: 1, interviews: 0, replies: 0 },
    });
    expect(pushed).toEqual([
      expect.objectContaining({
        to: TOKEN,
        title: 'Good morning: 2 new jobs, 1 follow-up due',
        body: 'Best: Job a · Acme · 90%',
        data: { url: '/alerts' },
      }),
    ]);
  });

  it('sends nothing before its time, when off, or with no news', async () => {
    await goodJob('a', 90);
    const early = morning();
    early.setHours(6, 0);
    expect(await briefing.sendDue(early)).toBe(0);

    const off = await t.gql(`mutation { setBriefing(input: { on: false, at: "07:30" }) }`);
    expect(off.data).toEqual({ setBriefing: true });
    expect(await briefing.sendDue(morning())).toBe(0);

    await t.gql(`mutation { setBriefing(input: { on: true, at: "07:30" }) }`);
    await t.prisma.hiddenJob.create({ data: { userId: 1, jobId: 'a' } });
    expect(await briefing.sendDue(morning())).toBe(0);
    expect(pushed).toEqual([]);
  });

  it('refuses a bad time or token', async () => {
    const time = await t.gql(`mutation { setBriefing(input: { on: true, at: "7am" }) }`);
    expect(time.errors?.[0]?.message).toMatch(/time like 07:30/);
    const token = await t.gql(`mutation { registerPushToken(token: "hello") }`);
    expect(token.errors?.[0]?.extensions).toMatchObject({ apiCode: 'PUSH_TOKEN_INVALID' });
  });
});
