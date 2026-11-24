/** What the morning briefing counts. */
export interface BriefingCounts {
  /** New jobs since the last briefing with at least your "match" Fit %. */
  newJobs: number;
  /** Queued jobs whose Apply kit is written. */
  kits: number;
  /** Applications waiting 7+ days with no news ("Follow up?"). */
  followUps: number;
  /** Interviews later today. */
  interviews: number;
  /** Employer emails waiting for your OK (Gmail). */
  replies: number;
}

export const hasNews = (c: BriefingCounts): boolean =>
  c.newJobs + c.kits + c.followUps + c.interviews + c.replies > 0;

type Lang = 'en' | 'de';

const WORDS: Record<
  Lang,
  {
    title: string;
    nothing: string;
    newJobs: (n: number) => string;
    kits: (n: number) => string;
    followUps: (n: number) => string;
    interviews: (n: number) => string;
    replies: (n: number) => string;
    best: (title: string, company: string, fit: number) => string;
  }
> = {
  en: {
    title: 'Good morning',
    nothing: 'Nothing new today.',
    newJobs: (n) => `${String(n)} new ${n === 1 ? 'job' : 'jobs'}`,
    kits: (n) => `${String(n)} ${n === 1 ? 'kit' : 'kits'} ready`,
    followUps: (n) => `${String(n)} ${n === 1 ? 'follow-up' : 'follow-ups'} due`,
    interviews: (n) => `${String(n)} ${n === 1 ? 'interview' : 'interviews'} today`,
    replies: (n) => `${String(n)} employer ${n === 1 ? 'reply' : 'replies'}`,
    best: (title, company, fit) => `Best: ${title} · ${company} · ${String(fit)}%`,
  },
  de: {
    title: 'Guten Morgen',
    nothing: 'Heute gibt es nichts Neues.',
    newJobs: (n) => `${String(n)} ${n === 1 ? 'neuer Job' : 'neue Jobs'}`,
    kits: (n) => `${String(n)} ${n === 1 ? 'Kit' : 'Kits'} fertig`,
    followUps: (n) => `${String(n)}× nachfassen`,
    interviews: (n) => `${String(n)} ${n === 1 ? 'Interview' : 'Interviews'} heute`,
    replies: (n) => `${String(n)} ${n === 1 ? 'Antwort' : 'Antworten'} von Arbeitgebern`,
    best: (title, company, fit) => `Top: ${title} · ${company} · ${String(fit)} %`,
  },
};

/**
 * The push message: "Good morning: 4 new jobs, 3 kits ready" and the best new job underneath.
 * The phone shows it as written, so it is made in the user's language here.
 */
export function briefingText(
  counts: BriefingCounts,
  locale: string,
  best?: { title: string; company: string; fit: number },
): { title: string; body: string } {
  const w = WORDS[locale === 'de' ? 'de' : 'en'];
  const parts = [
    counts.newJobs ? w.newJobs(counts.newJobs) : '',
    counts.kits ? w.kits(counts.kits) : '',
    counts.interviews ? w.interviews(counts.interviews) : '',
    counts.followUps ? w.followUps(counts.followUps) : '',
    counts.replies ? w.replies(counts.replies) : '',
  ].filter(Boolean);
  const title = parts.length ? `${w.title}: ${parts.slice(0, 2).join(', ')}` : w.title;
  const rest = parts.slice(2).join(' · ');
  const bestLine = best ? w.best(best.title, best.company, best.fit) : '';
  const body = [rest, bestLine].filter(Boolean).join('\n') || (parts.length ? '' : w.nothing);
  return { title, body };
}

/** True when `now` is at the "HH:mm" time and no briefing went out today yet. */
export function isBriefingDue(at: string, sentAt: Date | null, now: Date): boolean {
  const [h, m] = at.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return false;
  const due = new Date(now);
  due.setHours(h, m, 0, 0);
  if (now < due) return false;
  return !sentAt || sentAt < due;
}
