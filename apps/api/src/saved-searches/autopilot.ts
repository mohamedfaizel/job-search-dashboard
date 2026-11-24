import type { VisaSponsorship } from '../generated/prisma/enums';

/** A saved search's Autopilot rules (Saved searches › more › Autopilot). */
export interface AutopilotRules {
  /** Queue a job when its Fit % is at least this. */
  autoQueueFitMin: number;
  /** Don't queue a job whose ad says there is no visa sponsorship. */
  autoQueueNeedsVisa: boolean;
  /** Hide a job when its Fit % is under this. 0 hides nothing for its Fit. */
  autoHideFitBelow: number;
}

/** What Autopilot knows about one new job. */
export interface AutopilotJob {
  id: string;
  /** Your Fit %; null when the job has no description to score. */
  fit: number | null;
  visa: VisaSponsorship | null;
  /** The job site says it's closed, or our still-open check found it closed. */
  closed: boolean;
  /** The same title at the same company was already on your list. */
  duplicate: boolean;
  /** You already track it, queued it or hid it: Autopilot leaves it alone. */
  handled: boolean;
}

export type AutopilotChoice = 'QUEUE' | 'HIDE' | 'KEEP';

/** What Autopilot does with one new job. */
export function choose(rules: AutopilotRules, job: AutopilotJob): AutopilotChoice {
  if (job.handled) return 'KEEP';
  if (job.closed || job.duplicate) return 'HIDE';
  if (job.fit === null) return 'KEEP';
  const visaOk = !rules.autoQueueNeedsVisa || job.visa !== 'NO';
  if (job.fit >= rules.autoQueueFitMin && visaOk) return 'QUEUE';
  if (job.fit < rules.autoHideFitBelow) return 'HIDE';
  return 'KEEP';
}

export interface AutopilotPlan {
  /** Best Fit first. */
  queue: string[];
  hide: string[];
  /** Left on Job posts for you to look at, including good jobs over the daily limit. */
  keep: string[];
}

/** Sorts new jobs into queue / hide / keep. `slots` is how many more it may queue today. */
export function plan(rules: AutopilotRules, jobs: AutopilotJob[], slots: number): AutopilotPlan {
  const result: AutopilotPlan = { queue: [], hide: [], keep: [] };
  const good: AutopilotJob[] = [];
  for (const job of jobs) {
    const choice = choose(rules, job);
    if (choice === 'QUEUE') good.push(job);
    else if (choice === 'HIDE') result.hide.push(job.id);
    else result.keep.push(job.id);
  }
  good.sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0));
  const room = Math.max(0, slots);
  result.queue = good.slice(0, room).map((job) => job.id);
  result.keep.push(...good.slice(room).map((job) => job.id));
  return result;
}

/** "Data Engineer (m/w/d)" and "data engineer" are the same title. */
export function sameTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(\s*[mwfdx](\s*[/|,]\s*[mwfdx])*\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
