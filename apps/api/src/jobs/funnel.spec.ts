import { describe, expect, it } from 'vitest';
import { ApplicationStatus as S, JobSource } from '../generated/prisma/enums';
import type { FunnelApp } from './funnel';
import { funnelStats } from './funnel';

const NOW = new Date('2026-11-09T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const app = (
  status: S,
  events: [S, number][],
  source: JobSource = JobSource.JOBHUNTER,
): FunnelApp => ({ status, source, events: events.map(([s, d]) => ({ status: s, at: day(d) })) });

describe('funnelStats', () => {
  it('counts how far each job got, also before a rejection', () => {
    const stats = funnelStats(
      [
        app(S.SAVED, [[S.SAVED, 1]]),
        app(S.APPLIED, [[S.APPLIED, 3]], JobSource.ARBEITSAGENTUR),
        app(S.REJECTED, [
          [S.APPLIED, 20],
          [S.INTERVIEWING, 10],
          [S.REJECTED, 5],
        ]),
        app(S.OFFER, [
          [S.APPLIED, 40],
          [S.INTERVIEWING, 30],
          [S.OFFER, 25],
        ]),
        app(S.REJECTED, [
          [S.APPLIED, 12],
          [S.REJECTED, 8],
        ]),
      ],
      NOW,
    );
    expect(stats).toMatchObject({
      tracked: 5,
      applied: 4,
      interviews: 2,
      offers: 1,
      rejected: 2,
      waiting: 1,
      responseRate: 0.75,
      interviewRate: 0.5,
      offerRate: 0.5,
      // 10, 10 and 4 days to the first answer.
      medianDaysToReply: 10,
      appliedLast7Days: 1,
      appliedLast30Days: 3,
    });
    expect(stats.bySource).toEqual([
      { source: JobSource.ARBEITSAGENTUR, applied: 1, interviews: 0, offers: 0 },
      { source: JobSource.JOBHUNTER, applied: 3, interviews: 2, offers: 1 },
    ]);
  });

  it('has no rates before you apply, and an even count takes the middle two', () => {
    const empty = funnelStats([app(S.SAVED, [])], NOW);
    expect(empty).toMatchObject({
      applied: 0,
      responseRate: null,
      interviewRate: null,
      offerRate: null,
      medianDaysToReply: null,
    });
    const two = funnelStats(
      [
        app(S.REJECTED, [
          [S.APPLIED, 10],
          [S.REJECTED, 8],
        ]),
        app(S.INTERVIEWING, [
          [S.APPLIED, 10],
          [S.INTERVIEWING, 4],
        ]),
        // Moved straight to Interviewing: no applying date to count from.
        app(S.INTERVIEWING, [[S.INTERVIEWING, 2]]),
      ],
      NOW,
    );
    expect(two.medianDaysToReply).toBe(4);
    expect(two.applied).toBe(3);
  });
});
