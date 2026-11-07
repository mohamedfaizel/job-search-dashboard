import { AD_PHRASES, compact, KNOWN_SKILLS, mentions } from './skills';
import { detectLanguage, keywordTokens, stopwordsFor, tokenize } from './text';
import type { DocumentFrequencies } from './tfidf';
import { documentFrequencies, rankTerms } from './tfidf';

/** How many keywords to show for a job. */
const KEYWORD_COUNT = 12;
/** Plain words (not tools, not phrases) a job may add, after the tools and phrases. */
const PLAIN_WORD_COUNT = 4;
/** Fewer tools and phrases than this, and plain words used once may fill the list. */
const FEW_TERMS = 5;

/**
 * Two-word phrases of the ad that start with a tool or a known skill ("figma mocks", "react query").
 * Phrases stop at punctuation, so words of two sentences never join. Most used first.
 */
export function toolPhrases(text: string, language: string | null, tools: ReadonlySet<string>) {
  const stop = stopwordsFor(language);
  const counts = new Map<string, number>();
  // A full stop ends a chunk only before a space, so "node.js" stays whole.
  for (const chunk of text.toLowerCase().split(/[,;:!?()[\]\n\r•|/]|\.\s|\s[-–—]\s/)) {
    const words = chunk.split(/\s+/).filter(Boolean);
    for (let i = 0; i + 1 < words.length; i++) {
      const pair = [words[i] ?? '', words[i + 1] ?? ''];
      const clean = pair.map((w) => tokenize(w, stop));
      // Each side one real word: no stopword, number or punctuation-only token.
      if (clean.some((w) => w.length !== 1)) continue;
      const [first = '', second = ''] = clean.map((w) => w[0] ?? '');
      // The tool leads ("figma mocks", "apollo client"): "evolve react" is a verb, not a skill.
      if (!tools.has(first)) continue;
      const phrase = `${first} ${second}`;
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  // Said twice, it is a thing the job needs ("Figma mocks"), not a passing pair of words.
  return [...counts]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase);
}

/** What we learn from all saved jobs at once. */
export interface Corpus {
  frequencies: DocumentFrequencies;
  /** Every city a job is in: a place is never a keyword, for any job. */
  cities: Set<string>;
  /** Every skill tag JobHunter gave any job, plus the skills we know: tools rank first. */
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
  /** JobHunter's cleaned-up title, or the ad's own. */
  title: string;
  /** JobHunter's cleaned-up title when it differs from the ad's, else null. */
  normalizedTitle: string | null;
  language: string | null;
}

/** The terms in order, keeping only the first of each spelling ("frontend" and "front-end"). */
function uniqueByCompact(terms: string[]): string[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = compact(term);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The skills, keywords and title a resume is checked against, for one job. The job popup and the
 * Fit column both use this, so they always show the same score. Terms in `removed` (taken out
 * with ×) are left out.
 */
export function jobTerms(job: TermsJob, removed: ReadonlySet<string>, corpus: Corpus): JobTerms {
  const raw = (job.raw ?? {}) as { normalized_title?: string; keyword_slugs?: string[] };
  const language = job.language ?? detectLanguage(job.description);

  // JobHunter's technology tags first, then its wider keyword tags ("mentoring", "ecommerce").
  const skills = uniqueByCompact(
    [...job.skills, ...(raw.keyword_slugs ?? [])].map((s) => s.toLowerCase()),
  ).filter((tag) => !removed.has(tag));

  // The company's own name and the city say nothing about the skills the job needs.
  const known = new Set([
    ...skills,
    ...keywordTokens(`${job.company.name} ${job.city ?? ''}`, null),
  ]);
  // "front-end" is the same as the skill "frontend": compare compact forms.
  const knownCompact = new Set([...known].map(compact));
  const description = job.description ?? '';
  const words = keywordTokens(description, language);
  const candidates = uniqueByCompact(
    rankTerms(words, corpus.frequencies).map((ranked) => ranked.term),
  ).filter(
    (term) => !knownCompact.has(compact(term)) && !corpus.cities.has(term) && !removed.has(term),
  );
  const fresh = (term: string) => !knownCompact.has(compact(term)) && !removed.has(term);
  // The ad's own phrases first ("core web vitals", "optimistic updates"): they say what the job
  // needs more clearly than one word. Then two-word phrases around a tool ("figma mocks").
  const phrases = AD_PHRASES.filter((phrase) => fresh(phrase) && mentions(description, phrase));
  const pairs = toolPhrases(description, language, corpus.skills).filter(
    // "front-end apps" only repeats a skill the job already lists.
    (pair) => fresh(pair) && !knownCompact.has(compact(pair.split(' ')[0] ?? '')),
  );
  const tools = candidates.filter((term) => corpus.skills.has(term));
  // A plain word ("bets", "fuzzy") is noise when the ad already names enough tools and phrases,
  // unless it uses the word twice. A short ad with few of those keeps its stand-out words. German
  // ads keep their nouns, which name the work ("Kundenberatung").
  const count = (term: string) => words.filter((w) => w === term).length;
  const few = phrases.length + pairs.length + tools.length < FEW_TERMS;
  const plain = candidates
    .filter((term) => !corpus.skills.has(term) && (few || language === 'de' || count(term) > 1))
    .slice(0, PLAIN_WORD_COUNT);
  const chosen = uniqueByCompact([...phrases, ...pairs, ...tools, ...plain]);
  // A word already inside a chosen phrase ("mocks" in "figma mocks") is not shown again.
  const inPhrase = (term: string) =>
    !term.includes(' ') &&
    chosen.some(
      (other) => other !== term && other.includes(' ') && other.split(' ').includes(term),
    );
  const keywords = chosen.filter((term) => !inPhrase(term)).slice(0, KEYWORD_COUNT);

  const normalizedTitle =
    raw.normalized_title && raw.normalized_title !== job.title ? raw.normalized_title : null;
  return { skills, keywords, title: normalizedTitle ?? job.title, normalizedTitle, language };
}
