import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const OVERVIEW = `query { adminOverview {
  users newThisWeek activeThisWeek withJobKey importsToday jobsAddedToday
  week { day imports }
  health { service state offInEnv nextRunAt }
} }`;

interface Overview {
  users: number;
  newThisWeek: number;
  activeThisWeek: number;
  withJobKey: number;
  importsToday: number;
  jobsAddedToday: number;
  week: { day: string; imports: number }[];
  health: { service: string; state: string; offInEnv: boolean; nextRunAt: string | null }[];
}

type Code = { errors?: { extensions?: Record<string, unknown> }[] };
const DAY = 24 * 60 * 60 * 1000;

describe('admin: overview', () => {
  let t: TestApp;

  beforeAll(async () => {
    // Nothing listens on these ports: both count as set up but down.
    t = await createTestApp({
      PDF_RENDERER_URL: 'http://127.0.0.1:9',
      RESUME_MATCHER_URL: 'http://127.0.0.1:9',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
    });
  });
  afterAll(async () => {
    for (const key of ['RESUME_MATCHER_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
      Reflect.deleteProperty(process.env, key);
    }
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  const run = (userId: number, finishedAt: Date, created: number) =>
    t.prisma.syncRun.create({
      data: {
        userId,
        searchKey: 'k',
        input: {},
        startedAt: finishedAt,
        finishedAt,
        complete: true,
        fetched: created,
        created,
        updated: 0,
      },
    });

  it('counts accounts, keys and imports, with the last 7 days', async () => {
    await t.prisma.user.update({
      where: { id: 2 },
      data: { createdAt: new Date(Date.now() - 30 * DAY), lastSeenAt: null },
    });
    await t.prisma.apiKey.create({
      data: { userId: 2, kind: 'JOBHUNTER', secret: 'enc', last4: 'abcd' },
    });
    const now = new Date();
    await run(2, now, 5);
    await run(1, now, 2);
    await run(2, new Date(now.getTime() - 2 * DAY), 9);
    await run(2, new Date(now.getTime() - 10 * DAY), 1);

    const res = await t.gql<{ adminOverview: Overview }>(OVERVIEW);
    expect(res.errors).toBeUndefined();
    const o = res.data!.adminOverview;
    expect(o).toMatchObject({
      users: 2,
      newThisWeek: 1,
      // The admin's own call counts as using the app.
      activeThisWeek: 1,
      withJobKey: 1,
      importsToday: 2,
      jobsAddedToday: 7,
    });
    expect(o.week.map((d) => d.imports)).toEqual([0, 0, 0, 0, 1, 0, 2]);
  });

  it('checks each part of the server', async () => {
    await t.gql(`mutation { createSavedSearch(input: { name: "S", titles: ["x"] }) { id } }`);
    const res = await t.gql<{ adminOverview: Overview }>(OVERVIEW);

    expect(res.data?.adminOverview.health).toEqual([
      { service: 'DATABASE', state: 'OK', offInEnv: false, nextRunAt: null },
      { service: 'PDF_MAKER', state: 'DOWN', offInEnv: false, nextRunAt: null },
      { service: 'RESUME_MATCHER', state: 'DOWN', offInEnv: false, nextRunAt: null },
      { service: 'GMAIL', state: 'OFF', offInEnv: true, nextRunAt: null },
      // The tests' .env switches both off.
      { service: 'SCHEDULER', state: 'OFF', offInEnv: true, nextRunAt: null },
      { service: 'STILL_OPEN', state: 'OFF', offInEnv: true, nextRunAt: null },
    ]);
  });

  it('is for admins only', async () => {
    const res: Code = await t.asUser(OVERVIEW);
    expect(res.errors?.[0]?.extensions?.['apiCode']).toBe('ADMIN_ONLY');
  });
});
