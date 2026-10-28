import type { TermCheckModel } from './insights.model';
import { mentions } from './skills';
import { stopwordsFor, tokenize } from './text';

/**
 * The parts of the score and their weights: the same as Resume-Matcher's ATS score, so the two
 * numbers can be compared.
 */
export const WEIGHTS = {
  keywords: 0.4,
  skills: 0.2,
  title: 0.15,
  sections: 0.15,
  dates: 0.1,
} as const;

/** Percent of the terms your resume mentions, or null when there is nothing to check. */
export function coverage(terms: TermCheckModel[]): number | null {
  if (terms.length === 0) return null;
  return Math.round((terms.filter((t) => t.inResume).length / terms.length) * 100);
}

/**
 * How well your resume names the job title: 100 when the whole title appears, otherwise the
 * share of its words that do. "(m/w/d)", "(all genders)" and other brackets are ignored.
 */
export function titleMatch(title: string, resume: string, language: string | null): number | null {
  const clean = title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  if (mentions(resume, clean)) return 100;
  const words = [...new Set(tokenize(clean, stopwordsFor(language)))];
  if (words.length === 0) return null;
  return Math.round((words.filter((w) => mentions(resume, w)).length / words.length) * 100);
}

export interface ScoreParts {
  keywords: number | null;
  skills: number | null;
  title: number | null;
}

/**
 * Our own match score (0-100), weighted like Resume-Matcher's. Sections and dates always count
 * as full: this check doesn't look at them, and tailoring a resume doesn't change them.
 * A part with nothing to check (null) is left out and the others share its weight.
 */
export function matchScore(parts: ScoreParts): number | null {
  const scored = [
    [parts.keywords, WEIGHTS.keywords],
    [parts.skills, WEIGHTS.skills],
    [parts.title, WEIGHTS.title],
  ].filter((part): part is [number, number] => part[0] !== null);
  if (scored.length === 0) return null;

  const full: [number, number][] = [
    [100, WEIGHTS.sections],
    [100, WEIGHTS.dates],
  ];
  const all = [...scored, ...full];
  const weight = all.reduce((sum, [, w]) => sum + w, 0);
  return Math.round(all.reduce((sum, [value, w]) => sum + value * w, 0) / weight);
}
