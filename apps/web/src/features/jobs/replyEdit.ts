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
 * Line `index` with its words changed to `words`, keeping its Markdown marks (# heading,
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
