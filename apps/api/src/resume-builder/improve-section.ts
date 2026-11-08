import { textToBuilderDoc, toMarkdown } from './builder-doc';
import type { BuilderSection } from './builder-doc';

/** One section as Markdown in the builder layout (no name, no header), "" when it is empty. */
export function sectionMarkdown(section: BuilderSection): string {
  const doc = toMarkdown({
    name: 'x',
    headline: '',
    contact: [],
    sections: [{ ...section, hidden: false }],
  });
  const at = doc.indexOf('\n## ');
  return at < 0 ? '' : doc.slice(at + 1).trim();
}

export interface ImprovePromptInput {
  /** The section as it is now, from `sectionMarkdown`. */
  section: string;
  language: string;
  /** The job the resume is for; null when improving the master resume. */
  job: { title: string; company: string; description: string } | null;
  /** Terms the job asks for that you ticked as yours and this section does not name yet. */
  mustAdd: string[];
  /** Your true lines with numbers. */
  achievements: string[];
  /** What you want from this pass, in your words. */
  instruction: string;
}

const DESCRIPTION_MAX = 6000;

/**
 * The AI chat prompt that improves one section. Honesty is the first rule: the same facts, better
 * words. The reply is checked afterwards (fact check), but the prompt asks for it up front.
 */
export function buildImprovePrompt(input: ImprovePromptInput): string {
  const german = input.language === 'de';
  const lines = [
    `Please improve one section of my ${german ? 'German' : 'English'} resume${
      input.job ? ` for the job "${input.job.title}" at ${input.job.company}` : ''
    }.`,
    '',
    'Rules:',
    '- Use only facts that are in my section or in the list "True lines" below. Never invent a skill, tool, number, employer, date or language level.',
    '- Do not change dates, employers, job titles, places or degrees.',
    `- Write in ${german ? 'German' : 'English'}. Short, concrete bullets that start with a verb; no filler.`,
    '- Keep the layout: "## " is the section title, "### Title | Organisation" starts a job, then a line with place and dates, then bullets starting with "- ".',
    '- Reply with only the improved section in this layout, no notes before or after it.',
  ];
  if (input.mustAdd.length) {
    lines.push(
      `- I have these skills and may use them where they fit, in my own words: ${input.mustAdd.join(', ')}. Add none that are not on this list.`,
    );
  }
  if (input.instruction.trim()) lines.push(`- Also: ${input.instruction.trim()}`);
  lines.push('', 'My section:', '"""', input.section.trim(), '"""');
  if (input.achievements.length) {
    lines.push('', 'True lines (you may use them):', ...input.achievements.map((a) => `- ${a}`));
  }
  if (input.job?.description.trim()) {
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

/**
 * Reads an AI reply into the section it improves. The section keeps its id, title and hidden
 * flag: the AI changes what is inside, not where it sits. Null when the reply has no content.
 */
export function readSuggestion(reply: string, original: BuilderSection): BuilderSection | null {
  const unfenced = reply
    .replace(/^\s*```[a-z]*\s*\n/i, '')
    .replace(/\n```\s*$/i, '')
    .trim();
  if (!unfenced) return null;
  // A reply without its "## " line is the section's content; give it the title it had.
  const markdown = /^##\s+\S/m.test(unfenced)
    ? unfenced.slice(unfenced.search(/^##\s+\S/m))
    : `## ${original.title || 'Section'}\n\n${unfenced}`;
  const parsed = textToBuilderDoc(`# x\n\n${markdown}`, 'x').sections[0];
  if (!parsed?.blocks.length) return null;
  return { ...parsed, id: original.id, title: original.title, hidden: original.hidden };
}
