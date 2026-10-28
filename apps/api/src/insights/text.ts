import { dan, deu, eng, fra, ita, nld, pol, por, spa, swe } from 'stopword';
import { detect } from 'tinyld';

/**
 * Guesses the language of a text as an ISO 639-1 code ("de", "en"), or null when the text is too
 * short to tell. tinyld is a small offline detector: no AI and no network call.
 */
export function detectLanguage(text: string | null | undefined): string | null {
  const clean = text?.trim() ?? '';
  if (clean.length < 40) return null;
  return detect(clean) || null;
}

// The stopword package names its lists by ISO 639-3 code; jobs store ISO 639-1.
const STOPWORD_LISTS: Record<string, string[]> = {
  en: eng,
  de: deu,
  fr: fra,
  es: spa,
  it: ita,
  nl: nld,
  pt: por,
  pl: pol,
  sv: swe,
  da: dan,
};

/** Words every job ad uses, so they never tell one job apart from another. */
const JOB_AD_WORDS = [
  // English
  'experience team work working role job position company candidate skills knowledge ability',
  'strong good great years year plus etc including within new opportunity looking join offer',
  'benefits apply responsibilities requirements about us well help make across use using',
  'will would can could must should also may get like',
  // German
  'erfahrung erfahrungen kenntnisse aufgaben profil bieten suchen bewerbung unternehmen',
  'mitarbeiter mitarbeitende gute sehr jahre bereich idealerweise sowie mwd',
  // Gender notes in titles: "(all genders)", "(m/w/d)"
  'genders gender divers',
]
  .join(' ')
  .split(' ');

/** Stopwords for a job: its own language, plus English because many ads mix in English. */
export function stopwordsFor(language: string | null): Set<string> {
  const lists = [eng, STOPWORD_LISTS[language ?? ''] ?? [], JOB_AD_WORDS];
  return new Set(lists.flat());
}

// A word may contain + # . - inside or at the end ("node.js", "c++", "c#", "ci-cd"), but a
// sentence's final full stop is not part of it.
const WORD = /[\p{L}\p{N}](?:[\p{L}\p{N}+#.-]*[\p{L}\p{N}+#])?/gu;

/** Lower-cased words of a text, without stopwords, numbers or single letters. */
export function tokenize(text: string, stopwords: Set<string>): string[] {
  return (text.toLowerCase().match(WORD) ?? []).filter(
    (word) => word.length > 1 && !/^\d+$/.test(word) && !stopwords.has(word),
  );
}

/**
 * The words of a job description that can be keywords. German capitalises every noun, so for
 * German we keep only capitalised words (and tech words like "c++"): that drops verbs such as
 * "bietet" or "arbeitest", which say nothing about the job. Gender endings ("Entwickler*innen")
 * are removed first, so "innen" doesn't become a keyword.
 */
export function keywordTokens(text: string, language: string | null): string[] {
  const clean = text.replace(/[*:_/]innen\b/g, '');
  const words = clean.match(WORD) ?? [];
  const kept =
    language === 'de' ? words.filter((w) => !/^\p{Ll}/u.test(w) || /[\d+#.]/.test(w)) : words;
  return tokenize(kept.join(' '), stopwordsFor(language));
}
