import { KNOWN_SKILLS } from './skills';
import { detectLanguage, keywordTokens } from './text';
import type { DocumentFrequencies } from './tfidf';
import { documentFrequencies, rankTerms } from './tfidf';

/** How many TF-IDF keywords to show for a job. */
export const KEYWORD_COUNT = 15;

/** What we learn from all saved jobs at once. */
export interface Corpus {
  frequencies: DocumentFrequencies;
  /** Every city a job is in: a place is never a keyword, for any job. */
  cities: Set<string>;
  /** Every skill tag JobsPipe gave any job, plus the skills we know: tools rank first. */
  skills: Set<string>;
}

export function buildCorpus(
  jobs: {
    description: string | null;
    language: string | null;
    city: string | null;
    skills: string[];
  }[],
): Corpus {
  return {
    frequencies: documentFrequencies(
      jobs.filter((j) => j.description).map((j) => keywordTokens(j.description ?? '', j.language)),
    ),
    cities: new Set(jobs.flatMap((j) => (j.city ? keywordTokens(j.city, null) : []))),
    skills: new Set([
      ...KNOWN_SKILLS,
      ...jobs.flatMap((j) => j.skills.map((s) => s.toLowerCase())),
    ]),
  };
}

/** The job fields the terms are read from. */
export interface TermsJob {
  title: string;
  description: string | null;
  language: string | null;
  skills: string[];
  city: string | null;
  raw: unknown;
  company: { name: string };
}

export interface JobTerms {
  skills: string[];
  keywords: string[];
  /** JobsPipe's cleaned-up title, or the ad's own. */
  title: string;
  /** JobsPipe's cleaned-up title when it differs from the ad's, else null. */
  normalizedTitle: string | null;
  language: string | null;
}

/**
 * The skills, keywords and title a resume is checked against, for one job. The job popup and the
 * Fit column both use this, so they always show the same score. Terms in `removed` (taken out
 * with ×) are left out.
 */
export function jobTerms(job: TermsJob, removed: ReadonlySet<string>, corpus: Corpus): JobTerms {
  const raw = (job.raw ?? {}) as { normalized_title?: string; keyword_slugs?: string[] };
  const language = job.language ?? detectLanguage(job.description);

  // JobsPipe's technology tags first, then its wider keyword tags ("mentoring", "ecommerce").
  const skills = [
    ...new Set([...job.skills, ...(raw.keyword_slugs ?? [])].map((s) => s.toLowerCase())),
  ].filter((tag) => !removed.has(tag));

  // The company's own name and the city say nothing about the skills the job needs.
  const known = new Set([
    ...skills,
    ...keywordTokens(`${job.company.name} ${job.city ?? ''}`, null),
  ]);
  const candidates = rankTerms(keywordTokens(job.description ?? '', language), corpus.frequencies)
    .map((ranked) => ranked.term)
    .filter((term) => !known.has(term) && !corpus.cities.has(term) && !removed.has(term));
  // Tools and technologies first, then the other words, each group in TF-IDF order.
  const keywords = [
    ...candidates.filter((term) => corpus.skills.has(term)),
    ...candidates.filter((term) => !corpus.skills.has(term)),
  ].slice(0, KEYWORD_COUNT);

  const normalizedTitle =
    raw.normalized_title && raw.normalized_title !== job.title ? raw.normalized_title : null;
  return { skills, keywords, title: normalizedTitle ?? job.title, normalizedTitle, language };
}
