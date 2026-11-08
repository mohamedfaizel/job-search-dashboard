/** The drag type a keyword chip sets, so a line only takes keywords (not sections or bullets). */
export const KEYWORD_TYPE = 'application/x-job-keyword';

/**
 * A line with a keyword added: onto the end of a list of skills ("Frontend: React, TypeScript"),
 * or in brackets after a sentence. You can still edit it; nothing is added for you.
 */
export function withKeyword(line: string, term: string): string {
  const text = line.trimEnd();
  if (!text) return term;
  if (text.toLowerCase().includes(term.toLowerCase())) return line;
  return /[:,]/.test(text) ? `${text.replace(/[.,;]$/, '')}, ${term}` : `${text} (${term})`;
}
