import { parseResume, plain } from '../documents/resume-doc';
import { canonicalSkill, mentions } from './skills';

/** What a finding is about. */
export type FactKind = 'NUMBER' | 'SKILL' | 'LEVEL';
/** Which text it was found in. */
export type FactPlace = 'RESUME' | 'COVER_LETTER';

export interface FactFinding {
  kind: FactKind;
  /** The number ("40%"), skill ("Kubernetes") or language level ("B2") as written. */
  text: string;
  where: FactPlace;
  /** The line it was found in, shortened, so you can find it. */
  context: string;
}

export interface FactCheckInput {
  /** The resume Claude wrote. */
  resume: string;
  coverLetter: string;
  /** Everything you have told us: master resumes (every language), profile skills, languages. */
  sources: string[];
  /** The job's skill tags: when the resume names one you never claimed, it is flagged too. */
  jobSkills: string[];
}

const CONTEXT_LENGTH = 90;

/** A line with a link, an e-mail or a phone number: contact details come from your profile. */
const CONTACT_LINE = /@|https?:\/\/|www\.|linkedin|github|\+\d/i;

/** Words after a number that make even a single digit a claim: "7 years", "3 Jahre". */
const DURATION = '(?:years?|yrs?|jahre[n]?|monate[n]?|months?)';

/**
 * A number as written: "40", "40%", "1.5", "50,000", "10k", "7+ years". A letter or digit right
 * before it means it is part of a word ("ES6", "B2") and not a number.
 */
const NUMBER = new RegExp(
  `(?<![\\p{L}\\p{N}.,])\\d+(?:[.,]\\d+)*(?:\\s?(?:%|k\\b|m\\b|mio\\b|tsd\\b)|\\+?(?=\\s+${DURATION}\\b)|\\+)?`,
  'giu',
);

/** CEFR language levels: A1 to C2. */
const LEVEL = /(?<![\p{L}\p{N}])[ABC][12](?![\p{L}\p{N}])/gu;

/** "01/2021" and "3.2021" are months of a date; the year is what counts. */
const MONTH_BEFORE_YEAR = /(?<![\d.,/])(?:0?[1-9]|1[0-2])\s*[./]\s*(?=(?:19|20)\d{2}\b)/g;

/** One spelling per number: "50.000" and "50,000" → "50000", "1,5" → "1.5", "40 %" → "40%". */
export function numberKey(raw: string): string {
  const lower = raw.toLowerCase().replace(/\s+/g, '').replace(/\+$/, '');
  const [, digits = '', suffix = ''] = /^([\d.,]+)(.*)$/.exec(lower) ?? [];
  const grouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(digits) ? digits.replace(/[.,]/g, '') : digits;
  return grouped.replace(',', '.') + suffix;
}

const DURATION_AFTER = new RegExp(`^\\+?\\s*${DURATION}\\b`, 'i');

/**
 * Every number-like piece of a text, keyed, and whether it is worth checking: not a bare single
 * digit like a list number or "Top 3", unless it counts time ("7 years").
 */
function numbersIn(text: string): { raw: string; key: string; claim: boolean }[] {
  const clean = text.replace(MONTH_BEFORE_YEAR, '');
  return [...clean.matchAll(NUMBER)].map((m) => {
    const raw = m[0].trim();
    const after = clean.slice(m.index + m[0].length);
    return {
      raw,
      key: numberKey(raw),
      claim: /\d{2}|[%.,+]|[km]$|mio|tsd/i.test(raw) || DURATION_AFTER.test(after),
    };
  });
}

const shorten = (line: string) => {
  const text = plain(line.replace(/^\s*[-*•–]\s+/, ''))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > CONTEXT_LENGTH ? `${text.slice(0, CONTEXT_LENGTH - 1)}…` : text;
};

/** Words that start a section about skills, and ones that start a section we skip. */
const SKILL_SECTION =
  /skill|technolog|tech stack|tools|kenntnisse|fähigkeiten|kompetenz|expertise/i;
const NOT_SKILLS = /language|sprach|interest|hobb|education|ausbildung|zertifi|certif|award|publi/i;

const MAX_SKILL_LENGTH = 40;
const MAX_SKILL_WORDS = 4;

/** The items of the resume's skills section: "Frontend: React, Vue" → "React", "Vue". */
export function skillItems(resume: string): string[] {
  const items: string[] = [];
  for (const section of parseResume(resume, '').sections) {
    if (!SKILL_SECTION.test(section.title) || NOT_SKILLS.test(section.title)) continue;
    const lines = section.blocks.flatMap((block) => {
      if (block.kind === 'paragraph') return [block.text];
      if (block.kind === 'bullets') return block.items;
      return [...block.bullets, ...block.lines];
    });
    for (const line of lines) {
      const text = plain(line).replace(/`/g, '');
      // "Frontend: React, Vue" → the part after a short label.
      const label = /^([^:]{1,30}):\s*(.+)$/.exec(text);
      for (const part of (label?.[2] ?? text).split(/[,;•|·]/)) {
        // "Docker (3 years)" → "Docker"
        const item = part.replace(/\s*\(.*?\)\s*/g, ' ').trim();
        if (
          item &&
          item.length <= MAX_SKILL_LENGTH &&
          item.split(/\s+/).length <= MAX_SKILL_WORDS
        ) {
          items.push(item);
        }
      }
    }
  }
  return items;
}

/** "REST APIs" is "REST API": plural s is ignored. */
function supported(source: string, skill: string): boolean {
  if (mentions(source, skill) || mentions(source, canonicalSkill(skill))) return true;
  const singular = skill.replace(/s\b/i, '');
  return singular.length >= 3 && singular !== skill && mentions(source, singular);
}

/**
 * Checks what Claude wrote against what you have told us about yourself, without AI. It flags a
 * number, a skill or a language level that is not in your resume or profile, so you can look at
 * it before you send. It cannot tell a lie from a fair rewording: it only asks you to look.
 */
export function factCheck({
  resume,
  coverLetter,
  sources,
  jobSkills,
}: FactCheckInput): FactFinding[] {
  const source = sources.join('\n');
  const known = new Set(numbersIn(source).map((n) => n.key));
  const knownLevels = new Set(source.match(LEVEL) ?? []);
  const findings: FactFinding[] = [];
  const seen = new Set<string>();
  const add = (finding: FactFinding) => {
    const id = `${finding.kind}|${finding.where}|${finding.text.toLowerCase()}`;
    if (seen.has(id)) return;
    seen.add(id);
    findings.push(finding);
  };

  const scan = (text: string, where: FactPlace) => {
    for (const line of text.split(/\r?\n/)) {
      if (CONTACT_LINE.test(line)) continue;
      for (const { raw, key, claim } of numbersIn(line)) {
        if (claim && !known.has(key)) {
          add({ kind: 'NUMBER', text: raw, where, context: shorten(line) });
        }
      }
      for (const level of line.match(LEVEL) ?? []) {
        if (!knownLevels.has(level)) {
          add({ kind: 'LEVEL', text: level, where, context: shorten(line) });
        }
      }
    }
  };
  scan(resume, 'RESUME');
  scan(coverLetter, 'COVER_LETTER');

  const named = [...skillItems(resume), ...jobSkills.filter((skill) => mentions(resume, skill))];
  for (const skill of named) {
    if (supported(source, skill)) continue;
    const line = resume.split(/\r?\n/).find((l) => mentions(l, skill)) ?? skill;
    add({ kind: 'SKILL', text: skill, where: 'RESUME', context: shorten(line) });
  }
  return findings;
}

/** Splits a skills line at commas, semicolons and bullets, but not inside brackets. */
function splitSkills(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;•|·]/.test(ch)) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/** The name of one skills item for comparing: no brackets, bold marks or extra spaces. */
const skillName = (item: string) =>
  item
    .replace(/\*\*|`/g, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Takes skills out of the Skills section of a Markdown resume: only list items on its lines
 * ("- **Frontend:** React, Vue"), never words inside a sentence, so no line can be cut in half.
 * A line left without any skill is dropped. Returns the new text and the skills it removed.
 */
export function removeSkillItems(
  resume: string,
  skills: string[],
): { text: string; removed: string[] } {
  const drop = new Set(skills.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const removed: string[] = [];
  let inSkills = false;
  const lines: string[] = [];
  for (const line of resume.split('\n')) {
    const heading = /^#{1,3}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const title = heading[1] ?? '';
      inSkills = SKILL_SECTION.test(title) && !NOT_SKILLS.test(title);
      lines.push(line);
      continue;
    }
    if (!inSkills || !line.trim()) {
      lines.push(line);
      continue;
    }
    const [, bullet = '', label = '', rest = ''] =
      /^(\s*[-*•]\s+)?(\*\*[^*]+\*\*\s*|[^:,]{1,30}:\s*)?(.*)$/.exec(line) ?? [];
    const kept: string[] = [];
    let changed = false;
    for (const part of splitSkills(rest)) {
      const name = skillName(part);
      if (name && drop.has(name)) {
        removed.push(part.replace(/\*\*|`/g, '').trim());
        changed = true;
      } else if (part.trim()) {
        kept.push(part.trim());
      }
    }
    if (!changed) lines.push(line);
    else if (kept.length) lines.push(`${bullet}${label}${kept.join(', ')}`);
  }
  return { text: lines.join('\n'), removed: [...new Set(removed)] };
}
