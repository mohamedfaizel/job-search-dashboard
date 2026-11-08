import { letterParagraphs } from '../documents/resume-doc';

export interface LetterPromptInput {
  language: string;
  job: { title: string; company: string; description: string };
  /** This job's resume as Markdown: the only source of facts besides the true lines. */
  resume: string;
  /** The letter as it is now; empty to write a first one. */
  letter: string;
  /** Terms the job asks for that you ticked as yours. */
  mustAdd: string[];
  /** Your true lines with numbers. */
  achievements: string[];
  /** What you want from this pass, in your words. */
  instruction: string;
}

const DESCRIPTION_MAX = 6000;

/**
 * The AI chat prompt that writes or improves the cover letter for one job. The letter is the
 * same kind the Apply kit asks for: it starts with the greeting and ends with the sign-off and
 * your name, and the tracker adds your address, the date, the company and the subject line.
 */
export function buildLetterPrompt(input: LetterPromptInput): string {
  const german = input.language === 'de';
  const lines = [
    `Please ${input.letter.trim() ? 'improve' : 'write'} my ${german ? 'German' : 'English'} cover letter for the job "${input.job.title}" at ${input.job.company}.`,
    '',
    'Rules:',
    '- Use only facts that are in my resume or in the list "True lines" below. Never invent a skill, tool, number, employer, date or language level, and no company facts you are not sure of.',
    '- 200 to 300 words in three short paragraphs: why this role and this company; what I can do for them, with two or three real examples from my resume as proof (not repeating my resume); a short confident close.',
    '- Start with the greeting and end with the sign-off and my name: my tracker adds my address, the date, the company and the subject line.',
    `- Write in ${german ? 'German' : 'English'}. Concrete and warm, no filler, no placeholders such as "[Company]" or "(fill in)".`,
    '- Reply with only the letter, no notes before or after it.',
  ];
  if (input.mustAdd.length) {
    lines.push(
      `- I have these skills and may mention them where they fit, in my own words: ${input.mustAdd.join(', ')}. Mention none that are not on this list.`,
    );
  }
  if (input.instruction.trim()) lines.push(`- Also: ${input.instruction.trim()}`);
  lines.push('', 'My resume:', '"""', input.resume.trim(), '"""');
  if (input.letter.trim()) {
    lines.push('', 'My letter now:', '"""', input.letter.trim(), '"""');
  }
  if (input.achievements.length) {
    lines.push('', 'True lines (you may use them):', ...input.achievements.map((a) => `- ${a}`));
  }
  if (input.job.description.trim()) {
    lines.push(
      '',
      'The job ad:',
      '"""',
      input.job.description.trim().slice(0, DESCRIPTION_MAX),
      '"""',
    );
  }
  return lines.join('\n');
}

/** An AI reply as the letter's text: paragraphs separated by a blank line. Empty if it has none. */
export function readLetter(reply: string): string {
  // A fence line (```) alone on a line is never part of the letter.
  return letterParagraphs(reply.replace(/^[ \t]*```[a-z]*[ \t]*$/gim, '')).join('\n\n');
}
