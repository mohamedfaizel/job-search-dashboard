import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NightlyKitsService } from '../src/nightly-kits/nightly-kits.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, saveAiKey, seedTestUsers } from './helpers';

const REPLY = `=== RESUME ===
Data Engineer
Python, SQL, Airflow. German: A2.
=== COVER LETTER ===
Dear team, I would like to join you.
=== FORM ANSWERS ===
Notice period: 1 month
=== CHECK ===
- Changes: none`;

const BELL = /* GraphQL */ `
  query {
    notifications {
      items {
        kind
        count
        failed
        reason
        jobs {
          id
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
      failed: number;
      reason: string | null;
      jobs: { id: string }[];
    }[];
  };
}

describe('nightly apply kits', () => {
  let t: TestApp;
  let kits: NightlyKitsService;
  let status = 200;
  const asked: string[] = [];
  const real = globalThis.fetch;

  beforeAll(async () => {
    t = await createTestApp();
    kits = t.app.get(NightlyKitsService);
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    status = 200;
    asked.length = 0;
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes('api.anthropic.com')) return real(input, init);
      if (url.includes('/v1/models')) {
        return Promise.resolve(Response.json({ data: [{ id: 'claude-sonnet-5-5' }] }));
      }
      asked.push(typeof init?.body === 'string' ? init.body : '');
      return Promise.resolve(
        status === 200
          ? Response.json({ content: [{ type: 'text', text: REPLY }] })
          : new Response(null, { status }),
      );
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Two queued jobs for user 1, and a resume to tailor. */
  async function setUp(resume = 'Data Engineer. Python, SQL. German: A2.') {
    await t.prisma.profile.create({ data: { userId: 1, resumeText: resume } });
    const company = await t.prisma.company.create({ data: { name: 'Acme' } });
    for (const [i, id] of ['a', 'b'].entries()) {
      await t.prisma.job.create({
        data: {
          id,
          source: 'MANUAL',
          title: `Data Engineer ${id}`,
          companyId: company.id,
          postedAt: new Date(),
          description: 'We need Python, SQL and Airflow.',
          listedFor: { create: { userId: 1 } },
          applyQueue: { create: { userId: 1, position: i + 1 } },
        },
      });
    }
  }

  it('writes the kits of queued jobs with your key, up to the nightly limit', async () => {
    await setUp();
    await saveAiKey(t.gql);

    expect(await kits.run(1, 1)).toEqual({ written: 1, failed: 0, waiting: 1 });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('max_tokens');
    const kit = await t.prisma.jobResume.findUniqueOrThrow({
      where: { userId_jobId: { userId: 1, jobId: 'a' } },
    });
    expect(kit.coverLetter).toContain('Dear team');
    expect(kit.formAnswers).toContain('Notice period');

    const bell = await t.gql<Bell>(BELL);
    expect(bell.data!.notifications.items[0]).toMatchObject({
      kind: 'KITS_READY',
      count: 1,
      failed: 0,
      jobs: [{ id: 'a' }],
    });

    // Job a has its kit now: the next run writes b only.
    expect(await kits.run(1, 5)).toEqual({ written: 1, failed: 0, waiting: 0 });
    expect(await kits.run(1, 5)).toBeNull();
  });

  it('runs at your kits time, catches up a missed night once, and skips users who are off', async () => {
    await setUp();
    await saveAiKey(t.gql);
    const yesterday = new Date(Date.now() - 24 * 3_600_000);
    await t.prisma.profile.update({
      where: { userId: 1 },
      data: { nightlyKits: true, nightlyKitsAt: '00:00', nightlyKitsRanAt: yesterday },
    });
    await t.prisma.profile.create({ data: { userId: 2, nightlyKits: false } });

    // The PC was off at 00:00 today: it runs now, and only once.
    expect(await kits.runDue(new Date())).toBe(1);
    expect(asked).toHaveLength(2);
    expect(await kits.runDue(new Date())).toBe(0);
    expect(asked).toHaveLength(2);
  });

  it('also writes kits for good new jobs when you turn it on, never for hidden, old or guessed ones', async () => {
    await setUp('Data Engineer. Python, SQL, Airflow. German: A2.');
    await saveAiKey(t.gql);
    const company = await t.prisma.company.findFirstOrThrow();
    const old = new Date(Date.now() - 30 * 24 * 3_600_000);
    const listed = (id: string, extra: Record<string, unknown> = {}, addedAt = new Date()) =>
      t.prisma.job.create({
        data: {
          id,
          source: 'MANUAL',
          title: `Data Engineer ${id}`,
          companyId: company.id,
          postedAt: new Date(),
          description: 'We need Python, SQL and Airflow.',
          listedFor: { create: { userId: 1, addedAt } },
          ...extra,
        },
      });
    await listed('good');
    await listed('hidden', { hiddenBy: { create: { userId: 1 } } });
    await listed('old', {}, old);
    await listed('closed', { postingStatus: 'expired' });
    await listed('weak', { description: 'We need Java, Kotlin and Spring.' });
    await listed('guess', { description: '' });

    // Off by default: the Apply queue only.
    expect((await kits.waitingJobs(1)).map((j) => j.jobId)).toEqual(['a', 'b']);

    const saved = await t.gql(
      `mutation { setNightlyKits(input: { on: true, perNight: 5, at: "03:00", fitMin: 70 }) }`,
    );
    expect(saved.errors).toBeUndefined();
    expect((await kits.waitingJobs(1)).map((j) => j.jobId)).toEqual(['a', 'b', 'good']);

    expect(await kits.run(1, 5)).toEqual({ written: 3, failed: 0, waiting: 0 });
    // It has a kit now, so it is not written twice.
    expect((await kits.waitingJobs(1)).map((j) => j.jobId)).toEqual([]);

    const tooLow = await t.gql(
      `mutation { setNightlyKits(input: { on: true, perNight: 5, at: "03:00", fitMin: 20 }) }`,
    );
    expect(tooLow.errors?.[0]?.message).toMatch(/50 to 95/);
  });

  it('tells you when there is no key, or the key is refused', async () => {
    await setUp();
    expect(await kits.run(1, 5)).toBeNull();
    let bell = await t.gql<Bell>(BELL);
    expect(bell.data!.notifications.items[0]).toMatchObject({
      kind: 'KITS_FAILED',
      reason: 'NO_KEY',
    });

    await saveAiKey(t.gql);
    status = 401;
    expect(await kits.run(1, 5)).toEqual({ written: 0, failed: 0, waiting: 2 });
    expect(asked).toHaveLength(1);
    bell = await t.gql<Bell>(BELL);
    expect(bell.data!.notifications.items[0]).toMatchObject({
      kind: 'KITS_FAILED',
      reason: 'KEY_REFUSED',
    });
  });

  it('counts a job whose reply failed and goes on with the next', async () => {
    await setUp();
    await saveAiKey(t.gql);
    status = 500;
    expect(await kits.run(1, 5)).toEqual({ written: 0, failed: 2, waiting: 2 });
    const bell = await t.gql<Bell>(BELL);
    expect(bell.data!.notifications.items[0]).toMatchObject({
      kind: 'KITS_FAILED',
      failed: 2,
      reason: 'NONE_WRITTEN',
    });
  });

  it('stops when there is no resume to tailor', async () => {
    await setUp('');
    await saveAiKey(t.gql);
    expect(await kits.run(1, 5)).toEqual({ written: 0, failed: 0, waiting: 2 });
    expect(asked).toHaveLength(0);
    const bell = await t.gql<Bell>(BELL);
    expect(bell.data!.notifications.items[0]).toMatchObject({ reason: 'NO_RESUME' });
  });

  it('saves the settings and refuses Write now without a key or work', async () => {
    const saved = await t.gql(
      `mutation { setNightlyKits(input: { on: true, perNight: 3, at: "22:15" }) }`,
    );
    expect(saved.data).toEqual({ setNightlyKits: true });
    const profile = await t.gql<{
      myProfile: { nightlyKits: boolean; nightlyKitsMax: number; nightlyKitsAt: string };
    }>(`query { myProfile { nightlyKits nightlyKitsMax nightlyKitsAt } }`);
    expect(profile.data!.myProfile).toEqual({
      nightlyKits: true,
      nightlyKitsMax: 3,
      nightlyKitsAt: '22:15',
    });

    const noKey = await t.gql(`mutation { writeKitsNow }`);
    expect(noKey.errors?.[0]?.extensions).toMatchObject({ apiCode: 'AI_KEY_MISSING' });
    await saveAiKey(t.gql);
    const empty = await t.gql(`mutation { writeKitsNow }`);
    expect(empty.errors?.[0]?.extensions).toMatchObject({ apiCode: 'KITS_QUEUE_EMPTY' });

    const tooMany = await t.gql(
      `mutation { setNightlyKits(input: { on: true, perNight: 99, at: "03:00" }) }`,
    );
    expect(tooMany.errors?.[0]?.message).toMatch(/1 to 20/);
    const badTime = await t.gql(
      `mutation { setNightlyKits(input: { on: true, perNight: 3, at: "25:00" }) }`,
    );
    expect(badTime.errors?.[0]?.message).toMatch(/like 03:00/);
  });

  const KIT_RUN = `query { kitRun { running total done written failed reason } }`;
  type Run = { kitRun: Record<string, unknown> | null };

  it('shows Write now progress, then the result, in Settings', async () => {
    await setUp();
    await saveAiKey(t.gql);

    const started = await t.gql<{ writeKitsNow: number }>(`mutation { writeKitsNow }`);
    expect(started.data).toEqual({ writeKitsNow: 2 });
    expect((await t.gql<Run>(KIT_RUN)).data!.kitRun).toMatchObject({ running: true, total: 2 });

    await vi.waitFor(async () => {
      expect((await t.gql<Run>(KIT_RUN)).data!.kitRun).toEqual({
        running: false,
        total: 2,
        done: 2,
        written: 2,
        failed: 0,
        reason: null,
      });
    });
    const again = await t.gql(`mutation { writeKitsNow }`);
    expect(again.errors?.[0]?.extensions).toMatchObject({ apiCode: 'KITS_NOTHING_TO_WRITE' });
  });

  it('says why a run wrote nothing, and never fails silently', async () => {
    await setUp();
    await saveAiKey(t.gql);
    status = 401;
    await kits.run(1, 5);
    expect((await t.gql<Run>(KIT_RUN)).data!.kitRun).toMatchObject({
      running: false,
      written: 0,
      reason: 'KEY_REFUSED',
    });

    status = 200;
    vi.spyOn(t.prisma.jobFit, 'findMany').mockRejectedValueOnce(new Error('db down'));
    expect(await kits.run(1, 5)).toBeNull();
    expect((await t.gql<Run>(KIT_RUN)).data!.kitRun).toMatchObject({
      running: false,
      reason: 'NONE_WRITTEN',
    });
    const bell = await t.gql<Bell>(BELL);
    expect(bell.data!.notifications.items[0]).toMatchObject({
      kind: 'KITS_FAILED',
      reason: 'NONE_WRITTEN',
    });
  });
});
