import { mentions } from '../insights/skills';

/** The parts of a story a prompt needs. */
export interface StoryForPrompt {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  tags: string[];
}

/** At most this many stories go into one prompt, so it stays short. */
export const STORIES_PER_PROMPT = 5;

/** One story as prompt text: its title and tags, then S, T, A, R (and the reflection, if any). */
export function storyText(story: StoryForPrompt): string {
  const tags = story.tags.length ? ` [${story.tags.join(', ')}]` : '';
  const parts = [
    ['Situation', story.situation],
    ['Task', story.task],
    ['Action', story.action],
    ['Result', story.result],
    ['Reflection', story.reflection],
  ]
    .filter(([, text]) => text?.trim())
    .map(([label, text]) => `  ${label ?? ''}: ${(text ?? '').trim()}`);
  return [`- ${story.title}${tags}`, ...parts].join('\n');
}

/**
 * The stories that fit this job best: the most of its skills in a story's tags or text first,
 * then your order (the one changed last first). Stories that show none come last, so a short
 * bank is still used.
 */
export function pickStories(
  stories: StoryForPrompt[],
  jobTerms: string[],
  max = STORIES_PER_PROMPT,
): StoryForPrompt[] {
  const scored = stories.map((story, index) => {
    const text = [
      story.title,
      ...story.tags,
      story.situation,
      story.task,
      story.action,
      story.result,
    ].join('\n');
    return { story, index, score: jobTerms.filter((term) => mentions(text, term)).length };
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .map((s) => s.story);
}

/** The story bank as a prompt part, or nothing when it is empty. */
export function storiesPart(stories: string[]): string {
  return stories.length
    ? `\n\nMy story bank (true stories in STAR form: situation, task, action, result). Use them for the behavioural answers, keep their facts and numbers as they are, and say which story an answer uses:\n${stories.join('\n')}`
    : '';
}
