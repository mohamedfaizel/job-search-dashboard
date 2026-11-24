/** One saved search's week: the new jobs its runs brought, and how many fit you. */
export interface SearchWeek {
  id: number;
  name: string;
  /** It runs by itself (its schedule is not OFF), so pausing it saves credits. */
  scheduled: boolean;
  /** New jobs its runs put on your list this week. */
  jobs: number;
  /** Of those, the ones with at least your "match" Fit %. */
  good: number;
}

/** What the weekly report counts. */
export interface WeeklyCounts {
  /** Jobs you marked Applied this week. */
  applied: number;
  /** Employer replies this week: moved to Interviewing, Offer or Rejected. */
  replies: number;
  /** Of those, the interviews. */
  interviews: number;
  /** New jobs on your list this week. */
  newJobs: number;
  /** Of those, the ones with at least your "match" Fit %. */
  goodJobs: number;
}

/** A search needs this many new jobs in a week, none of them good, before the report says pause. */
export const PAUSE_MIN_JOBS = 5;

/** The search that brought the most good jobs (more jobs breaks a tie). Null when none did. */
export function bestSearch(weeks: SearchWeek[]): SearchWeek | null {
  let best: SearchWeek | null = null;
  for (const week of weeks) {
    if (week.good === 0) continue;
    if (!best || week.good > best.good || (week.good === best.good && week.jobs > best.jobs)) {
      best = week;
    }
  }
  return best;
}

/**
 * The scheduled search to pause: it brought at least PAUSE_MIN_JOBS new jobs and none of them
 * fit you. The one with the most jobs is named. Null when every search earns its runs.
 */
export function pauseSearch(weeks: SearchWeek[]): SearchWeek | null {
  let pick: SearchWeek | null = null;
  for (const week of weeks) {
    if (!week.scheduled || week.good > 0 || week.jobs < PAUSE_MIN_JOBS) continue;
    if (!pick || week.jobs > pick.jobs) pick = week;
  }
  return pick;
}

export const hasWeek = (c: WeeklyCounts): boolean => c.applied + c.replies + c.newJobs > 0;

type Lang = 'en' | 'de';

const WORDS: Record<
  Lang,
  {
    title: string;
    applied: (n: number) => string;
    replies: (n: number) => string;
    goodJobs: (n: number) => string;
    best: (name: string, n: number) => string;
    pause: (name: string) => string;
  }
> = {
  en: {
    title: 'Your week',
    applied: (n) => `${String(n)} applied`,
    replies: (n) => `${String(n)} ${n === 1 ? 'reply' : 'replies'}`,
    goodJobs: (n) => `${String(n)} good ${n === 1 ? 'job' : 'jobs'}`,
    best: (name, n) => `Best search: ${name} (${String(n)} good)`,
    pause: (name) => `Pause "${name}"? No good jobs this week`,
  },
  de: {
    title: 'Deine Woche',
    applied: (n) => `${String(n)} beworben`,
    replies: (n) => `${String(n)} ${n === 1 ? 'Antwort' : 'Antworten'}`,
    goodJobs: (n) => `${String(n)} ${n === 1 ? 'guter Job' : 'gute Jobs'}`,
    best: (name, n) => `Beste Suche: ${name} (${String(n)} gute)`,
    pause: (name) => `„${name}“ pausieren? Diese Woche keine guten Jobs`,
  },
};

/** The push message: "Your week: 3 applied, 1 reply, 8 good jobs", then best and pause lines. */
export function weeklyText(
  counts: WeeklyCounts,
  locale: string,
  best: SearchWeek | null,
  pause: SearchWeek | null,
): { title: string; body: string } {
  const w = WORDS[locale === 'de' ? 'de' : 'en'];
  const parts = [w.applied(counts.applied), w.replies(counts.replies), w.goodJobs(counts.goodJobs)];
  const lines = [best ? w.best(best.name, best.good) : '', pause ? w.pause(pause.name) : ''];
  return { title: `${w.title}: ${parts.join(', ')}`, body: lines.filter(Boolean).join('\n') };
}
