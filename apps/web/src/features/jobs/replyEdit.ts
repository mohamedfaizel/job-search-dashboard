/**
 * Line-by-line editing of Claude's reply, for the preview in the Apply kit. The resume is the
 * Markdown layout the prompt asks for (# Name, ## Section, ### Job | Company, - bullet), so
 * every line can be shown and changed on its own without parsing the whole resume.
 */

export type LineKind = 'name' | 'section' | 'entry' | 'bullet' | 'text' | 'blank';

export interface ReplyLine {
  kind: LineKind;
  /** The words to show, without the Markdown marks (#, -, **). */
  text: string;
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;
const BULLET = /^\s*[-*•–]\s+(.*)$/;
const BOLD_LINE = /^\*\*([^*]+)\*\*:?$/;

/** What one line of the resume is, and its words without Markdown. */
export function readLine(line: string): ReplyLine {
  const trimmed = line.trim();
  if (!trimmed) return { kind: 'blank', text: '' };
  const heading = HEADING.exec(trimmed);
  if (heading) {
    const level = heading[1]?.length ?? 1;
    const text = heading[2] ?? '';
    return { kind: level === 1 ? 'name' : level === 2 ? 'section' : 'entry', text };
  }
  const bold = BOLD_LINE.exec(trimmed);
  if (bold) return { kind: 'section', text: bold[1] ?? '' };
  const bullet = BULLET.exec(line);
  if (bullet) return { kind: 'bullet', text: bullet[1] ?? '' };
  return { kind: 'text', text: trimmed };
}

export const splitLines = (text: string): string[] => text.replace(/\r\n?/g, '\n').split('\n');

/** Puts `value` (one line, or several) in place of line `index`. */
export function replaceLine(text: string, index: number, value: string): string {
  const lines = splitLines(text);
  lines.splice(index, 1, ...splitLines(value));
  return lines.join('\n');
}

/** Adds `value` as a new line after line `index` (-1 puts it first). */
export function insertLine(text: string, index: number, value: string): string {
  const lines = splitLines(text);
  lines.splice(index + 1, 0, ...splitLines(value));
  return lines.join('\n');
}

export function deleteLine(text: string, index: number): string {
  const lines = splitLines(text);
  lines.splice(index, 1);
  return lines.join('\n');
}

/** A new line written like the one it follows: a bullet after a bullet, else plain text. */
export function lineLike(previous: string, value: string): string {
  const bullet = /^(\s*[-*•–]\s+)/.exec(previous);
  return bullet ? `${bullet[1] ?? '- '}${value}` : value;
}

/**
 * A line with its words changed to `words`, keeping its Markdown marks (# heading,
 * - bullet, **bold**). Several lines of words give several lines, each marked the same way.
 */
export function rewordLine(original: string, words: string): string {
  const parts = splitLines(words.trim());
  const heading = /^(\s*#{1,6}\s+)/.exec(original);
  const bullet = /^(\s*[-*•–]\s+)/.exec(original);
  const bold = BOLD_LINE.test(original.trim());
  return parts
    .map((part, i) => {
      if (heading) return i === 0 ? `${heading[1] ?? '# '}${part}` : part;
      if (bold) return i === 0 ? `**${part}**` : part;
      if (bullet) return `${bullet[1] ?? '- '}${part}`;
      return part;
    })
    .join('\n');
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern for a term as a whole word, written with or without hyphens, dots or spaces. */
function termPattern(term: string, flags = 'iu'): RegExp {
  const parts = term
    .trim()
    .split(/[-./\s_]+/)
    .filter(Boolean)
    .map(escapeRegExp);
  return new RegExp(`(?<![\\p{L}\\p{N}])${parts.join('[-./ ]?')}(?![\\p{L}\\p{N}+#])`, flags);
}

/**
 * True when the text has the term as a whole word ("Figma mocks", "figma-mocks"), the way the
 * API scores it (apps/api/src/insights/skills.ts, mentions), so the count moves as you type.
 */
export function mentionsTerm(text: string, term: string): boolean {
  return term.trim() !== '' && termPattern(term).test(text);
}

/** Indexes of the lines that hold the resume's own content: bullets and plain text, not headings. */
export function contentLines(text: string): number[] {
  return splitLines(text)
    .map((line, i) => ({ kind: readLine(line).kind, i }))
    .filter(({ kind }) => kind === 'bullet' || kind === 'text' || kind === 'entry')
    .map(({ i }) => i);
}

const SKILLS_HEADING = /skill|kenntnis|kompetenz|competenc|technolog|tools/i;

/** The first line of the resume's Skills section (or -1): the place to add a plain keyword. */
export function skillsLine(text: string): number {
  const lines = splitLines(text);
  let inSkills = false;
  for (const [i, line] of lines.entries()) {
    const { kind, text: words } = readLine(line);
    if (kind === 'section' || kind === 'name') inSkills = SKILLS_HEADING.test(words);
    else if (inSkills && (kind === 'bullet' || kind === 'text')) return i;
  }
  return -1;
}

/** The term added to the end of a line: "- **Tools:** React, Jest" + "detox" → "…, Jest, detox". */
export function appendTerm(line: string, term: string): string {
  return `${line.replace(/[\s.,;]+$/, '')}, ${term}`;
}

/** The content line that best fits a term: one naming the skill it goes with, else the first. */
export function bestLine(text: string, related: string | null): number {
  const lines = splitLines(text);
  const content = contentLines(text).filter((i) => readLine(lines[i] ?? '').kind === 'bullet');
  if (related) {
    const hit = content.find((i) => mentionsTerm(lines[i] ?? '', related));
    if (hit !== undefined) return hit;
  }
  return content[0] ?? contentLines(text)[0] ?? 0;
}

/** Every whole-word `word` replaced by `term`. Returns the new text and how many lines changed. */
export function replaceWord(text: string, word: string, term: string) {
  if (!word.trim()) return { text, lines: 0 };
  const pattern = termPattern(word, 'giu');
  let lines = 0;
  const next = splitLines(text).map((line) => {
    const changed = line.replace(pattern, term);
    if (changed !== line) lines += 1;
    return changed;
  });
  return { text: next.join('\n'), lines };
}

/** Splits a line into plain parts and parts that are one of the terms, to show them marked. */
export function markTerms(line: string, terms: string[]): { text: string; mark: boolean }[] {
  const usable = terms.filter((t) => t.trim());
  if (!usable.length) return [{ text: line, mark: false }];
  const sources = usable.map((t) => termPattern(t).source).join('|');
  const pattern = new RegExp(sources, 'giu');
  const parts: { text: string; mark: boolean }[] = [];
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const start = match.index;
    if (start > last) parts.push({ text: line.slice(last, start), mark: false });
    parts.push({ text: match[0], mark: true });
    last = start + match[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), mark: false });
  return parts;
}
