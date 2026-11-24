import { describe, expect, it } from 'vitest';
import type { SearchWeek, WeeklyCounts } from './weekly';
import { bestSearch, hasWeek, pauseSearch, weeklyText } from './weekly';

const week = (over: Partial<SearchWeek>): SearchWeek => ({
  id: 1,
  name: 'A',
  scheduled: true,
  jobs: 0,
  good: 0,
  ...over,
});
const counts: WeeklyCounts = { applied: 3, replies: 1, interviews: 1, newJobs: 20, goodJobs: 1 };

describe('weekly report', () => {
  it('picks the search with the most good jobs, more jobs breaking a tie', () => {
    expect(bestSearch([])).toBeNull();
    expect(bestSearch([week({ jobs: 9 })])).toBeNull();
    const a = week({ id: 1, good: 2, jobs: 3 });
    const b = week({ id: 2, good: 2, jobs: 5 });
    const c = week({ id: 3, good: 1, jobs: 9 });
    expect(bestSearch([a, b, c])).toBe(b);
    expect(bestSearch([c, a])).toBe(a);
  });

  it('asks to pause only a scheduled search with many jobs and none good', () => {
    expect(pauseSearch([week({ jobs: 4 })])).toBeNull();
    expect(pauseSearch([week({ jobs: 9, good: 1 })])).toBeNull();
    expect(pauseSearch([week({ jobs: 9, scheduled: false })])).toBeNull();
    const small = week({ id: 1, jobs: 5 });
    const big = week({ id: 2, jobs: 12 });
    expect(pauseSearch([small, big])).toBe(big);
    expect(pauseSearch([big, small])).toBe(big);
  });

  it('knows a quiet week', () => {
    expect(hasWeek({ applied: 0, replies: 0, interviews: 0, newJobs: 0, goodJobs: 0 })).toBe(false);
    expect(hasWeek(counts)).toBe(true);
  });

  it('writes the push in your language', () => {
    expect(weeklyText(counts, 'en', null, null)).toEqual({
      title: 'Your week: 3 applied, 1 reply, 1 good job',
      body: '',
    });
    const best = week({ name: 'Frontend', good: 4 });
    const pause = week({ name: 'Sales', jobs: 8 });
    expect(weeklyText({ ...counts, replies: 2, goodJobs: 4 }, 'de', best, pause)).toEqual({
      title: 'Deine Woche: 3 beworben, 2 Antworten, 4 gute Jobs',
      body: 'Beste Suche: Frontend (4 gute)\n„Sales“ pausieren? Diese Woche keine guten Jobs',
    });
    expect(weeklyText(counts, 'de', null, null).title).toBe(
      'Deine Woche: 3 beworben, 1 Antwort, 1 guter Job',
    );
  });
});
