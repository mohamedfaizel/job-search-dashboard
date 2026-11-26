import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KitJob } from '../src/nightly-kits/nightly-kits.service';
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

describe('apply kits', () => {
  let t: TestApp;
  let kits: NightlyKitsService;
  let status = 200;
  const asked: string[] = [];
  /** Replies the fake AI gives, in order; REPLY when it runs out. */
  const replies: string[] = [];
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
    replies.length = 0;
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
          ? Response.json({ content: [{ type: 'text', text: replies.shift() ?? REPLY }] })
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

  /** The two jobs as Autopilot hands them over, with the search's target score. */
  const jobs = (target = 70): KitJob[] =>
    ['a', 'b'].map((id) => ({ jobId: id, title: `Data Engineer ${id}`, company: 'Acme', target }));
  const one = (target = 70) => jobs(target).slice(0, 1);

  it('writes the kits of the jobs it is given, with your key', async () => {
    await setUp();
    await saveAiKey(t.gql);

    expect(await kits.writeFor(1, one())).toEqual({ written: 1, failed: 0, belowTarget: 0 });
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
    expect(await kits.writeFor(1, jobs())).toEqual({ written: 1, failed: 0, belowTarget: 0 });
    expect(asked).toHaveLength(2);
    expect(await kits.writeFor(1, jobs())).toBeNull();
    expect(asked).toHaveLength(2);
  });

  it('adds jobs handed over during a run to that run', async () => {
    await setUp();
    await saveAiKey(t.gql);

    const first = kits.writeFor(1, one());
    // A second search finished meanwhile: its job joins the run going now.
    expect(await kits.writeFor(1, jobs().slice(1))).toBeNull();
    expect(await first).toEqual({ written: 2, failed: 0, belowTarget: 0 });
    expect(asked).toHaveLength(2);
  });

  describe('target score', () => {
    const FIRST = REPLY.replace('Python, SQL, Airflow. German: A2.', 'Python, SQL. German: A2.');
    const BETTER = '=== RESUME ===\nData Engineer\nPython, SQL and Airflow pipelines. German: A2.';

    async function goal(master: string) {
      await setUp(master);
      await saveAiKey(t.gql);
    }
    const kitOf = (jobId: string) =>
      t.prisma.jobResume.findUniqueOrThrow({ where: { userId_jobId: { userId: 1, jobId } } });

    it('improves a kit below your target with terms you really have, keeping the cover letter', async () => {
      await goal('Data Engineer. Python, SQL, Airflow. German: A2.');
      replies.push(FIRST, BETTER);

      expect(await kits.writeFor(1, one(85))).toMatchObject({ written: 1, belowTarget: 0 });
      expect(asked).toHaveLength(2);
      expect(asked[1]).toContain('- airflow');
      expect(asked[1]).toContain('Never raise a level');
      const kit = await kitOf('a');
      expect(kit.text).toContain('Airflow');
      expect(kit.coverLetter).toContain('Dear team');
      expect(kit.score).toBeGreaterThanOrEqual(85);
    });

    it('never adds what you do not have: it stops at the best honest score and says so', async () => {
      await goal('Data Engineer. Python, SQL. German: A2.');
      replies.push(FIRST);

      expect(await kits.writeFor(1, one(90))).toMatchObject({ written: 1, belowTarget: 1 });
      expect(asked).toHaveLength(1);
      const { data } = await t.gql<{
        notifications: { items: { kind: string; belowTarget: number; target: number | null }[] };
      }>(`query { notifications { items { kind belowTarget target } } }`);
      expect(data!.notifications.items[0]).toEqual({
        kind: 'KITS_READY',
        belowTarget: 1,
        target: 90,
      });
    });

    it('keeps the earlier resume when a round scores lower', async () => {
      await goal('Data Engineer. Python, SQL, Airflow. German: A2.');
      replies.push(FIRST, '=== RESUME ===\nData Engineer\nAirflow.', '=== RESUME ===\nNothing.');

      await kits.writeFor(1, one(85));
      const kit = await kitOf('a');
      expect(kit.text).toContain('Python, SQL');
      expect(asked).toHaveLength(2);
    });
  });

  it('tells you when there is no key, or the key is refused', async () => {
    await setUp();
    expect(await kits.writeFor(1, jobs())).toBeNull();
    let bell = await t.gql<Bell>(BELL);
    expect(bell.data!.notifications.items[0]).toMatchObject({
      kind: 'KITS_FAILED',
      reason: 'NO_KEY',
    });

    await saveAiKey(t.gql);
    status = 401;
    expect(await kits.writeFor(1, jobs())).toEqual({ written: 0, failed: 0, belowTarget: 0 });
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
    expect(await kits.writeFor(1, jobs())).toEqual({ written: 0, failed: 2, belowTarget: 0 });
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
    expect(await kits.writeFor(1, jobs())).toEqual({ written: 0, failed: 0, belowTarget: 0 });
    expect(asked).toHaveLength(0);
    const bell = await t.gql<Bell>(BELL);
    expect(bell.data!.notifications.items[0]).toMatchObject({ reason: 'NO_RESUME' });
  });

  const KIT_RUN = `query { kitRun { running total done written failed reason } }`;
  type Run = { kitRun: Record<string, unknown> | null };

  it('shows the progress of a run, then its result', async () => {
    await setUp();
    await saveAiKey(t.gql);

    const run = kits.writeFor(1, jobs());
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
    expect(await run).toEqual({ written: 2, failed: 0, belowTarget: 0 });
  });

  it('says why a run wrote nothing, and never fails silently', async () => {
    await setUp();
    await saveAiKey(t.gql);
    status = 401;
    await kits.writeFor(1, jobs());
    expect((await t.gql<Run>(KIT_RUN)).data!.kitRun).toMatchObject({
      running: false,
      written: 0,
      reason: 'KEY_REFUSED',
    });

    status = 200;
    vi.spyOn(t.prisma.jobResume, 'findMany').mockRejectedValueOnce(new Error('db down'));
    expect(await kits.writeFor(1, jobs())).toBeNull();
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
