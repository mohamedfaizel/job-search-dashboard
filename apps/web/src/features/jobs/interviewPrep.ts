/**
 * Splits Claude's interview prep reply into its six parts, and the parts into questions, gaps and
 * checklist items, so the Interview tab can show them as tabs and flash cards. The prompt asks
 * for fixed headings ("## 3. Likely questions", "Q1.", "Gap:", "- [ ] "), but Claude's spelling
 * varies a little and older replies have other headings, so the parsing is forgiving. When it
 * can't find the parts, the tab shows the reply as plain text.
 */

export const PART_KEYS = ['care', 'about', 'questions', 'gaps', 'ask', 'research'] as const;
export type PartKey = (typeof PART_KEYS)[number];

export interface PrepPart {
  key: PartKey;
  body: string;
}
export interface PrepQuestion {
  question: string;
  why: string;
  answer: string;
}
export interface PrepGap {
  skill: string;
  say: string;
  learn: string;
}

// What each part's heading talks about, for headings without Markdown marks.
const PART_WORDS: Record<PartKey, RegExp> = {
  care: /care|matter|want/i,
  about: /yourself|about (you|me)/i,
  questions: /question/i,
  gaps: /gap/i,
  ask: /question|ask/i,
  research: /research|checklist|read/i,
};
const HEADING = /^\s*(#{1,4}\s*)?(\*\*)?\s*(?:part\s*)?([1-6])\s*[.):]\s*(.+?)\s*$/i;

/** Removes Markdown bold and italics marks. */
export function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^\*+|\*+$/g, '')
    .trim();
}

/** The six parts, in order. Fewer than three found means the reply has another shape: []. */
export function splitPrep(text: string): PrepPart[] {
  const lines = text.split(/\r?\n/);
  const starts: { key: PartKey; line: number }[] = [];
  lines.forEach((line, i) => {
    const next = PART_KEYS[starts.length];
    if (!next) return;
    const m = HEADING.exec(line);
    if (!m || Number(m[3]) !== starts.length + 1) return;
    const title = plain(m[4] ?? '').replace(/:$/, '');
    const marked = Boolean(m[1] ?? m[2]);
    // A numbered question is not a heading.
    if (title.includes('?') || title.length > 60) return;
    if (!marked && !PART_WORDS[next].test(title)) return;
    starts.push({ key: next, line: i });
  });
  if (starts.length < 3) return [];
  return starts.map((start, i) => ({
    key: start.key,
    body: lines
      .slice(start.line + 1, starts[i + 1]?.line ?? lines.length)
      .join('\n')
      .trim(),
  }));
}

const LABEL = (word: string) =>
  new RegExp(`^\\s*[-*•]?\\s*[*_]*\\s*${word}\\s*[*_]*\\s*:[*_]*\\s*(.*)$`, 'i');
const WHY = LABEL('(?:why (?:they|do they) ask|warum (?:sie )?(?:fragen|fragt))');
const ANSWER = LABEL('(?:(?:model |sample |your )?answer|(?:muster)?antwort)');
const QUESTION_START = /^\s*(?:#{1,4}\s*)?[*_]*\s*(Q\s*)?(\d{1,2})\s*[.):]\s*[*_]*\s*(.+)$/i;
const HAS_Q = /^\s*(?:#{1,4}\s*)?[*_]*\s*Q\s*\d/im;

/** The questions of part 3, each with why they ask it and a model answer. */
export function parseQuestions(body: string): PrepQuestion[] {
  const out: PrepQuestion[] = [];
  let current: PrepQuestion | null = null;
  let field: 'question' | 'why' | 'answer' = 'question';
  // With "Q1." questions, a numbered list inside an answer is not a new question.
  const needsQ = HAS_Q.test(body);
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const why = WHY.exec(line);
    const answer = ANSWER.exec(line);
    const found = !why && !answer ? QUESTION_START.exec(line) : null;
    const start = found && (!needsQ || found[1]) ? found : null;
    if (start) {
      current = { question: plain(start[3] ?? ''), why: '', answer: '' };
      out.push(current);
      field = 'question';
    } else if (!current) {
      continue;
    } else if (why) {
      current.why = plain(why[1] ?? '');
      field = 'why';
    } else if (answer) {
      current.answer = plain(answer[1] ?? '');
      field = 'answer';
    } else {
      current[field] = `${current[field]}${field === 'answer' ? '\n' : ' '}${plain(line)}`.trim();
    }
  }
  return out.filter((q) => q.question);
}

const GAP = LABEL('(?:gap|lücke)');
const SAY = LABEL('(?:say|honest answer|how to answer|sag(?:e)?)');
const LEARN = LABEL('(?:learn(?: this week)?|(?:diese woche )?lernen)');

/** The gaps of part 4: what to say about each, and what to learn this week. */
export function parseGaps(body: string): PrepGap[] {
  const out: PrepGap[] = [];
  let current: PrepGap | null = null;
  let field: 'say' | 'learn' = 'say';
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const gap = GAP.exec(line);
    const say = SAY.exec(line);
    const learn = LEARN.exec(line);
    if (gap) {
      current = { skill: plain(gap[1] ?? ''), say: '', learn: '' };
      out.push(current);
      field = 'say';
    } else if (!current) {
      continue;
    } else if (say) {
      current.say = plain(say[1] ?? '');
      field = 'say';
    } else if (learn) {
      current.learn = plain(learn[1] ?? '');
      field = 'learn';
    } else {
      current[field] = `${current[field]} ${plain(line)}`.trim();
    }
  }
  return out.filter((g) => g.skill);
}

const ITEM = /^\s*(?:[-*•]|\d{1,2}[.)])\s+(?:\[[ xX]?\]\s*)?(.+)$/;

/** The list lines of a part ("- ", "1. ", "- [ ] "), as plain text. */
export function listItems(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => ITEM.exec(line)?.[1])
    .filter((item): item is string => Boolean(item))
    .map(plain);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text: string, word: string) =>
  new RegExp(`(^|[^a-z0-9])${escape(word)}($|[^a-z0-9])`, 'i').test(text);

/** The gap a skill chip points to: the chip's word in the gap's name, or the other way round. */
export function findGap(gaps: PrepGap[], term: string): number {
  return gaps.findIndex((g) => hasWord(g.skill, term) || hasWord(term, g.skill));
}
