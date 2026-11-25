import type { TermCheckModel } from '../insights/insights.model';

/** At most this many extra AI rounds per kit, so a kit never costs more than about 3 calls. */
export const MAX_IMPROVE_ROUNDS = 2;

/**
 * The job's terms the tailored resume still misses, but that you really have: your master
 * resume names them, or they are on your Skills list. Only these may be added: the rest would be
 * made up, so they stay missing and the kit keeps its honest score.
 */
export function honestMissing(before: TermCheckModel[], stillMissing: string[]): string[] {
  const missing = new Set(stillMissing);
  return before
    .filter((check) => missing.has(check.term) && (check.inResume || check.youHave))
    .map((check) => check.term);
}

export interface ImproveInput {
  title: string;
  company: string;
  /** The tailored resume as saved now. */
  resume: string;
  score: number;
  target: number;
  /** From honestMissing: terms you really have that it does not name yet. */
  terms: string[];
  /** Your master resume, the only source of facts. */
  master: string;
  /** Your languages with their real levels, e.g. "German (A2)". */
  languages: string[];
}

/**
 * One more round for a kit whose resume scores below your target: work in the job's terms you
 * really have, change nothing else. The reply is the resume only, so the cover letter and form
 * answers saved before stay as they are.
 */
export function buildImprovePrompt(input: ImproveInput): string {
  const languages = input.languages.length
    ? input.languages.join(', ')
    : 'exactly as in the resume below';
  return `You tailored my resume for "${input.title}" at ${input.company}. It covers ${String(input.score)}% of the job ad; I want ${String(input.target)}% or more, honestly.

The ad asks for these, and I really have them (they are in my master resume or my skills list), but the tailored resume does not name them yet:
${input.terms.map((term) => `- ${term}`).join('\n')}

Rewrite the tailored resume so it names each of them where it is true for me: in the summary, the bullet of the job where I used it, and the skills. Use the ad's exact words, in normal sentences.

Rules:
- Never add a skill, tool, employer, title, date or number that is not in my master resume below. If a term does not fit honestly, leave it out.
- Never stuff, repeat or hide keywords.
- Keep my languages and their levels exactly: ${languages}. Never raise a level.
- Keep everything else (sections, order, dates, contact line) as it is.
- Reply with the whole resume only, starting with the line === RESUME ===. No cover letter, form answers or notes.

=== TAILORED RESUME (now) ===
${input.resume}

=== MY MASTER RESUME (the only source of facts) ===
${input.master}
`;
}
