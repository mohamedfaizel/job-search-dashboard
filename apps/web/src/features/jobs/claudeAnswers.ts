import type { SavedAnswer } from '@jobsearch/data';

/** What you decided about one of Claude's stretches or answered to one of its questions. */
export interface NoteEntry {
  /** A stretch: keep it, rewrite it, or drop it. */
  choice?: 'keep' | 'soften' | 'drop' | undefined;
  /** The new wording when you soften a stretch. */
  text?: string | undefined;
  /** Your answer to a question. An empty answer on purpose stops a saved answer being filled in. */
  answer?: string | undefined;
  /** Keep the answer for the next jobs. Defaults to yes. */
  remember?: boolean | undefined;
}

export type NoteAnswers = Record<string, NoteEntry>;

/** The JSON text saved on the job back into entries. Anything unreadable gives no decisions. */
export function parseAnswers(json: string): NoteAnswers {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as NoteAnswers;
  } catch {
    return {};
  }
}

/** Words too common to tell two questions apart. */
const FILLER = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'do',
  'does',
  'did',
  'you',
  'your',
  'my',
  'me',
  'i',
  'it',
  'of',
  'to',
  'in',
  'on',
  'for',
  'and',
  'or',
  'with',
  'what',
  'which',
  'how',
  'right',
  'correct',
  'please',
  'claude',
  'assumed',
  'yes',
  'ist',
  'der',
  'die',
  'das',
  'und',
  'ein',
  'eine',
  'du',
  'dein',
  'deine',
  'hast',
  'bist',
  'was',
  'wie',
  'welche',
]);

function words(question: string): Set<string> {
  return new Set(
    question
      .toLowerCase()
      .replace(/[^\p{L}\p{N}€$%]+/gu, ' ')
      .split(' ')
      .filter((word) => word.length > 1 && !FILLER.has(word)),
  );
}

/** How much of the shorter question's words the other one shares (0 to 1). */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

/**
 * The saved answer for a question Claude asks, when you answered the same thing before. Claude
 * words each question its own way, so it compares the meaningful words and takes the best match
 * that shares at least two thirds of them.
 */
export function matchSaved(question: string, bank: SavedAnswer[]): SavedAnswer | null {
  const asked = words(question);
  let best: SavedAnswer | null = null;
  let bestScore = 0;
  for (const saved of bank) {
    const score = overlap(asked, words(saved.question));
    if (score >= 2 / 3 && score > bestScore) {
      best = saved;
      bestScore = score;
    }
  }
  return best;
}

/** The answer a question has now: yours, else the saved one (when filling in is on). */
export function effectiveAnswer(
  question: string,
  entry: NoteEntry | undefined,
  bank: SavedAnswer[],
  fill: boolean,
): { answer: string; saved: boolean } {
  if (entry?.answer !== undefined) return { answer: entry.answer, saved: false };
  const match = fill ? matchSaved(question, bank) : null;
  return { answer: match?.answer ?? '', saved: match !== null };
}

interface Sections {
  stretches: string[];
  questions: string[];
}

/**
 * The message that gives Claude your decisions, to paste in the same chat. It asks for the whole
 * reply again, so pasting that in step 2 saves the improved version.
 */
export function followUpPrompt(
  { stretches, questions }: Sections,
  answers: NoteAnswers,
  bank: SavedAnswer[],
  fill: boolean,
): string {
  const lines: string[] = [];
  for (const item of stretches) {
    const entry = answers[item];
    if (entry?.choice === 'keep') lines.push(`- Keep: ${item}`);
    if (entry?.choice === 'drop') lines.push(`- Drop: ${item}`);
    if (entry?.choice === 'soften' && entry.text?.trim()) {
      lines.push(`- Soften: ${item}\n  Write it like this instead: ${entry.text.trim()}`);
    }
  }
  const answered: string[] = [];
  for (const question of questions) {
    const { answer } = effectiveAnswer(question, answers[question], bank, fill);
    if (answer.trim()) answered.push(`- ${question}\n  ${answer.trim()}`);
  }
  return `Thanks. Here are my answers to the questions in your CHECK part.

${lines.length ? `Lines you flagged as stretches:\n${lines.join('\n')}\n\n` : ''}${answered.length ? `Your questions:\n${answered.join('\n')}\n\n` : ''}Please update the resume, cover letter and form answers where this applies. Never add anything beyond what I wrote here. Then send the whole reply again in the same format as before (the same === markers and the CHECK part), so I can paste it back.`;
}

/** How many of the notes have a decision or an answer, and how many answers came from the bank. */
export function progress(
  { stretches, questions }: Sections,
  answers: NoteAnswers,
  bank: SavedAnswer[],
  fill: boolean,
): { answered: number; filled: number } {
  let answered = stretches.filter((item) => answers[item]?.choice).length;
  let filled = 0;
  for (const question of questions) {
    const { answer, saved } = effectiveAnswer(question, answers[question], bank, fill);
    if (answer.trim()) answered += 1;
    if (saved && answer.trim()) filled += 1;
  }
  return { answered, filled };
}
