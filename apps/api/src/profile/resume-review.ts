import { LONG_DASH_DATE } from '../insights/pdf-check';

/**
 * Suggestions for your master resume, shown on My profile as soon as you upload or edit it.
 * Free and instant (no AI): plain checks of the text, with the same rules the tailoring prompt
 * gives Claude. For a deeper look there is a review prompt to paste into Claude.
 */
export type SuggestionCode =
  | 'LEVEL'
  | 'DATES'
  | 'CLICHES'
  | 'SYMBOLS'
  | 'NUMBERS'
  | 'LENGTH'
  | 'CONTACT'
  | 'WORK_PERMIT'
  | 'ACHIEVEMENTS';

export interface ResumeSuggestion {
  code: SuggestionCode;
  /** What was found, for the message. ACHIEVEMENTS: the lines, one per line. */
  detail: string;
}

export interface ReviewInput {
  text: string;
  /** Your languages with your real level, from My profile: "German A2". */
  languages: string[];
  workPermit: string;
  achievements: string;
  maxPages: number;
}

/** Words that make a resume sound generic (the same list the tailoring prompt bans). */
const CLICHES = [
  'passionate',
  'leverage',
  'synergy',
  'drive results',
  'hit the ground running',
  'team player',
  'results-driven',
  'dynamic',
  'cutting-edge',
  'go-getter',
  'detail-oriented',
  'self-starter',
];

/** About this many words fit on a resume page. */
const WORDS_PER_PAGE = 450;

/** Names of a language in English and German, so "Deutsch: B2" is found for "German A2". */
const LANGUAGE_NAMES: Record<string, string[]> = {
  german: ['german', 'deutsch'],
  english: ['english', 'englisch'],
  french: ['french', 'französisch'],
  spanish: ['spanish', 'spanisch'],
};

const LEVEL = /\b([ABC][12])\b/;
const PERMIT =
  /chancenkarte|opportunity card|blue card|blaue karte|work permit|arbeitserlaubnis|aufenthaltstitel|niederlassungserlaubnis/i;
const SYMBOLS = /[→⇒★☆✓✔❖➤►▪◆◇—]|\p{Extended_Pictographic}/gu;
const BULLET = /^\s*[-*•▪◦]\s+/;
const ACHIEVEMENTS_HEADING =
  /^(?:#{1,3}\s*)?(?:key\s+)?(?:achievements|erfolge|accomplishments)\s*:?$/i;
/** A heading in a resume's plain text: "## Skills", or a short line in capitals. */
const isHeading = (line: string) =>
  /^#{1,3}\s/.test(line) || (/^[\p{Lu}\s&/-]{4,40}$/u.test(line) && /\p{Lu}{3}/u.test(line));

const unique = (items: string[]) => [...new Set(items)];

/** The level the resume gives a language you listed, when it differs from your profile. */
function levelMismatches(text: string, languages: string[]): string[] {
  const found: string[] = [];
  for (const entry of languages) {
    const [, name = '', level = ''] = /^(\p{L}+).*?\b([ABC][12])\b/iu.exec(entry) ?? [];
    if (!name || !level) continue;
    const names = LANGUAGE_NAMES[name.toLowerCase()] ?? [name.toLowerCase()];
    for (const line of text.split('\n')) {
      const lower = line.toLowerCase();
      const at = names.map((n) => lower.indexOf(n)).find((i) => i >= 0);
      if (at === undefined) continue;
      const near = LEVEL.exec(line.slice(at, at + 30));
      if (near?.[1] && near[1].toUpperCase() !== level.toUpperCase()) {
        found.push(`${name}: ${near[1]} → ${level.toUpperCase()}`);
      }
    }
  }
  return unique(found);
}

/** The lines of the resume's Achievements section, without bullet marks. */
function achievementsSection(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim());
  const start = lines.findIndex((l) => ACHIEVEMENTS_HEADING.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line) continue;
    if (isHeading(line)) break;
    if (BULLET.test(line) || !out.length) out.push(line.replace(BULLET, ''));
    // A wrapped line belongs to the bullet before it.
    else out[out.length - 1] = `${out[out.length - 1] ?? ''} ${line}`;
  }
  return out;
}

/** Suggestions for the resume text, most important first. Empty when it looks good. */
export function reviewResume(input: ReviewInput): ResumeSuggestion[] {
  const text = input.text;
  if (!text.trim()) return [];
  const out: ResumeSuggestion[] = [];
  const add = (code: SuggestionCode, detail: string) => out.push({ code, detail });

  const levels = levelMismatches(text, input.languages);
  if (levels.length) add('LEVEL', levels.join(', '));

  const head = text.split('\n').slice(0, 12).join(' ');
  const missing = [
    /[\w.+-]+@[\w-]+\.[\w.]+/.test(head) ? null : 'e-mail',
    /\+?\d[\d\s/()-]{7,}\d/.test(head) ? null : 'phone',
    /linkedin/i.test(text) ? null : 'LinkedIn',
  ].filter((m): m is string => m !== null);
  if (missing.length) add('CONTACT', missing.join(', '));

  const permit = PERMIT.exec(text);
  if (permit && !input.workPermit.trim()) add('WORK_PERMIT', permit[0]);

  const dates = unique([...text.matchAll(LONG_DASH_DATE)].map((m) => m[0]));
  if (dates.length) add('DATES', dates.slice(0, 3).join(', '));

  const lower = text.toLowerCase();
  const cliches = CLICHES.filter((c) => new RegExp(`\\b${c}\\b`).test(lower));
  if (cliches.length) add('CLICHES', cliches.join(', '));

  const symbols = unique([...text.matchAll(SYMBOLS)].map((m) => m[0]));
  if (symbols.length) add('SYMBOLS', symbols.join(' '));

  const bullets = text.split('\n').filter((l) => BULLET.test(l));
  const withNumbers = bullets.filter((l) => /\d/.test(l)).length;
  if (bullets.length >= 6 && withNumbers / bullets.length < 0.4) {
    add('NUMBERS', `${String(withNumbers)}/${String(bullets.length)}`);
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  const pages = Math.ceil(words / WORDS_PER_PAGE);
  if (pages > input.maxPages)
    add('LENGTH', `${String(words)}/${String(pages)}/${String(input.maxPages)}`);

  const achievements = achievementsSection(text);
  if (achievements.length && !input.achievements.trim()) {
    add('ACHIEVEMENTS', achievements.join('\n'));
  }
  return out;
}

/**
 * A prompt to paste into Claude (with your resume in it) for a recruiter's review of your
 * master resume: the top fixes, weak lines and missing proof, without inventing anything.
 */
export function buildMasterReviewPrompt(input: ReviewInput): string {
  const languages = input.languages.length
    ? `\nMy real language levels (the resume must use these): ${input.languages.join(', ')}.`
    : '';
  return `Please review my resume as an experienced tech recruiter in Germany would. Do not rewrite it all; tell me what to change.

Give me:
1. The five changes that would help most, most important first, each with the line to change and a better version.
2. Weak bullets: lines without a result or a number, with a stronger version that uses only facts already in my resume (ask me when a number is missing; never invent one).
3. ATS problems: tables, columns, icons, long dashes in dates, contact details only in links, unusual headings.
4. What is missing for the roles I target: skills, proof or sections a recruiter looks for.
5. Length: it should fit ${String(input.maxPages)} page${input.maxPages === 1 ? '' : 's'}. Which lines would you cut first?${languages}

My resume:
"""
${input.text.trim()}
"""`;
}
