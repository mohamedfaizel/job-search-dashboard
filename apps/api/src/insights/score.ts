import type { TermCheckModel } from './insights.model';

/** How much each list counts towards the score. Skills matter more than wording. */
export const SKILLS_WEIGHT = 0.6;
export const KEYWORDS_WEIGHT = 0.4;

/** Percent of the terms your resume mentions, or null when there is nothing to check. */
export function coverage(terms: TermCheckModel[]): number | null {
  if (terms.length === 0) return null;
  return Math.round((terms.filter((t) => t.inResume).length / terms.length) * 100);
}

/**
 * Our own match score (0-100): skills coverage × 60% + keywords coverage × 40%. When the job has
 * only one of the two lists, that list counts fully. Null when there is nothing to score.
 */
export function matchScore(skills: number | null, keywords: number | null): number | null {
  if (skills === null) return keywords;
  if (keywords === null) return skills;
  return Math.round(skills * SKILLS_WEIGHT + keywords * KEYWORDS_WEIGHT);
}
