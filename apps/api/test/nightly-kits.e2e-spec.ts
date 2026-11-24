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
    const saved = await t.gql(`mutation { setNightlyKits(input: { on: true, perNight: 3 }) }`);
    expect(saved.data).toEqual({ setNightlyKits: true });
    const profile = await t.gql<{ myProfile: { nightlyKits: boolean; nightlyKitsMax: number } }>(
      `query { myProfile { nightlyKits nightlyKitsMax } }`,
    );
    expect(profile.data!.myProfile).toEqual({ nightlyKits: true, nightlyKitsMax: 3 });

    const noKey = await t.gql(`mutation { writeKitsNow }`);
    expect(noKey.errors?.[0]?.extensions).toMatchObject({ apiCode: 'AI_KEY_MISSING' });
    await saveAiKey(t.gql);
    const nothing = await t.gql(`mutation { writeKitsNow }`);
    expect(nothing.errors?.[0]?.extensions).toMatchObject({ apiCode: 'KITS_NOTHING_TO_WRITE' });

    const tooMany = await t.gql(`mutation { setNightlyKits(input: { on: true, perNight: 99 }) }`);
    expect(tooMany.errors?.[0]?.message).toMatch(/1 to 20/);
  });
});
