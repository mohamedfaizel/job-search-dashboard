import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FitService } from '../src/insights/fit.service';
import { AutopilotService } from '../src/saved-searches/autopilot.service';
import type { TestApp } from './helpers';
import { createTestApp, resetDatabase, seedTestUsers } from './helpers';

const SET_AUTOPILOT = /* GraphQL */ `
  mutation ($id: Int!, $input: AutopilotInput!) {
    setSavedSearchAutopilot(id: $id, input: $input) {
      autopilot
      autoQueueFitMin
      autoQueueNeedsVisa
      autoHideFitBelow
      autoQueueMaxPerDay
    }
  }
`;

const NOTIFICATIONS = /* GraphQL */ `
  query {
    notifications {
      items {
        id
        kind
        searchName
        count
        hidden
        kept
        undone
        jobs {
          id
          fit
        }
      }
    }
  }
`;

const UNDO = /* GraphQL */ `
  mutation ($id: Int!) {
    undoAutopilot(notificationId: $id)
  }
`;

interface Bell {
  notifications: {
    items: {
      id: number;
      kind: string;
      searchName: string;
      count: number;
      hidden: number;
      kept: number;
      undone: boolean;
      jobs: { id: string; fit: number }[];
    }[];
  };
}

describe('Autopilot', () => {
  let t: TestApp;
  let autopilot: AutopilotService;

  beforeAll(async () => {
    t = await createTestApp();
    autopilot = t.app.get(AutopilotService);
    // The test sets the Fit scores itself.
    vi.spyOn(t.app.get(FitService), 'ensureFresh').mockResolvedValue();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await seedTestUsers(t.prisma);
  });

  async function search(autopilotOn = true) {
    return t.prisma.savedSearch.create({
      data: { userId: 1, name: 'Data', titles: ['data'], autopilot: autopilotOn },
    });
  }

  /** A job on user 1's list, added at `addedAt`, with this Fit %. */
  async function job(
    id: string,
    fit: number | null,
    extra: { title?: string; visa?: 'OFFERS' | 'NO' | 'NOT_STATED'; status?: string } = {},
    addedAt = new Date(),
  ) {
    const company = await t.prisma.company.upsert({
      where: { name: 'Acme' },
      create: { name: 'Acme' },
      update: {},
    });
    await t.prisma.job.create({
      data: {
        id,
        source: 'MANUAL',
        title: extra.title ?? `Job ${id}`,
        companyId: company.id,
        postedAt: new Date(),
        visa: extra.visa ?? 'NOT_STATED',
        postingStatus: extra.status ?? 'active',
        listedFor: { create: { userId: 1, addedAt } },
        ...(fit === null ? {} : { fits: { create: { userId: 1, score: fit } } }),
      },
    });
  }

  it('saves the rules and refuses a hide limit above the queue limit', async () => {
    const s = await search(false);
    const input = {
      autopilot: true,
      autoQueueFitMin: 80,
      autoQueueNeedsVisa: false,
      autoHideFitBelow: 30,
      autoQueueMaxPerDay: 5,
    };
    const ok = await t.gql(SET_AUTOPILOT, { id: s.id, input });
    expect(ok.data).toEqual({ setSavedSearchAutopilot: input });

    const bad = await t.gql(SET_AUTOPILOT, { id: s.id, input: { ...input, autoHideFitBelow: 80 } });
    expect(bad.errors?.[0]?.extensions).toMatchObject({ apiCode: 'AUTOPILOT_LIMITS' });
  });

  it('queues good fits, hides poor, closed and duplicate jobs, and undoes it', async () => {
    const s = await search();
    const before = new Date(Date.now() - 60_000);
    await job('old', null, { title: 'Data Engineer (m/w/d)' }, new Date(Date.now() - 86_400_000));
    await job('good', 90);
    await job('ok', 76);
    await job('noVisa', 95, { visa: 'NO' });
    await job('middle', 55);
    await job('poor', 20);
    await job('closed', 88, { status: 'expired' });
    await job('dup', 92, { title: 'data engineer' });
    await job('tracked', 10);
    await t.prisma.application.create({ data: { userId: 1, jobId: 'tracked', status: 'SAVED' } });

    const outcome = await autopilot.afterRun(1, s.id, before);
    expect(outcome).toEqual({ queued: 2, hidden: 3, kept: 3 });

    const queue = await t.prisma.applyQueueItem.findMany({ orderBy: { position: 'asc' } });
    expect(queue.map((q) => [q.jobId, q.auto])).toEqual([
      ['good', true],
      ['ok', true],
    ]);
    const hidden = await t.prisma.hiddenJob.findMany({ orderBy: { jobId: 'asc' } });
    expect(hidden.map((h) => h.jobId)).toEqual(['closed', 'dup', 'poor']);

    const bell = await t.gql<Bell>(NOTIFICATIONS);
    const note = bell.data!.notifications.items[0]!;
    expect(note).toMatchObject({
      kind: 'AUTOPILOT',
      searchName: 'Data',
      count: 2,
      hidden: 3,
      kept: 3,
      undone: false,
      jobs: [
        { id: 'good', fit: 90 },
        { id: 'ok', fit: 76 },
      ],
    });

    const undo = await t.gql(UNDO, { id: note.id });
    expect(undo.data).toEqual({ undoAutopilot: true });
    expect(await t.prisma.applyQueueItem.count()).toBe(0);
    expect(await t.prisma.hiddenJob.count()).toBe(0);
    const after = await t.gql<Bell>(NOTIFICATIONS);
    expect(after.data!.notifications.items[0]!.undone).toBe(true);
  });

  it('keeps to the daily limit across runs', async () => {
    const s = await search();
    await t.prisma.savedSearch.update({ where: { id: s.id }, data: { autoQueueMaxPerDay: 2 } });
    const first = new Date(Date.now() - 60_000);
    await job('a', 90);
    await job('b', 85);
    await job('c', 80);
    expect(await autopilot.afterRun(1, s.id, first)).toMatchObject({ queued: 2, kept: 1 });

    const second = new Date();
    await job('d', 99);
    expect(await autopilot.afterRun(1, s.id, second)).toBeNull();
    expect(await t.prisma.applyQueueItem.count()).toBe(2);
  });

  it('does nothing when Autopilot is off, or for another user', async () => {
    const s = await search(false);
    await job('good', 90);
    expect(await autopilot.afterRun(1, s.id, new Date(Date.now() - 60_000))).toBeNull();
    expect(await autopilot.afterRun(2, s.id, new Date(Date.now() - 60_000))).toBeNull();
    expect(await t.prisma.applyQueueItem.count()).toBe(0);

    const other = await t.gql(UNDO, { id: 12345 });
    expect(other.errors?.[0]?.extensions).toMatchObject({ apiCode: 'NOTIFICATION_NOT_FOUND' });
  });
});
