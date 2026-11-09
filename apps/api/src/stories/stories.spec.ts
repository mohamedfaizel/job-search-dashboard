import { describe, expect, it } from 'vitest';
import { buildInterviewPrompt } from '../insights/interview-prompt';
import { cleanStory, MAX_PART, MAX_TAGS, MAX_TITLE } from './stories.service';
import type { StoryForPrompt } from './story-prompt';
import { pickStories, storiesPart, storyText } from './story-prompt';

const story = (title: string, more: Partial<StoryForPrompt> = {}): StoryForPrompt => ({
  title,
  situation: '',
  task: '',
  action: '',
  result: '',
  reflection: '',
  tags: [],
  ...more,
});

describe('cleanStory', () => {
  const input = {
    title: '  Faster nightly load ',
    situation: ' The load took 4 h ',
    task: 'Make it fit the night',
    action: 'Moved it to Airflow',
    result: '40 min',
    reflection: '',
    tags: [' SQL', 'sql', '', 'Airflow '],
  };

  it('trims the parts and drops empty and double tags', () => {
    expect(cleanStory(input)).toEqual({
      title: 'Faster nightly load',
      situation: 'The load took 4 h',
      task: 'Make it fit the night',
      action: 'Moved it to Airflow',
      result: '40 min',
      reflection: '',
      tags: ['sql', 'Airflow'],
    });
  });

  it('refuses a story without a title or past a limit', () => {
    expect(cleanStory({ ...input, title: '  ' })).toBeNull();
    expect(cleanStory({ ...input, title: 'x'.repeat(MAX_TITLE + 1) })).toBeNull();
    expect(cleanStory({ ...input, action: 'x'.repeat(MAX_PART + 1) })).toBeNull();
    const tags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${String(i)}`);
    expect(cleanStory({ ...input, tags })).toBeNull();
    expect(cleanStory({ ...input, tags: ['x'.repeat(41)] })).toBeNull();
  });
});

describe('story prompt', () => {
  it('writes a story as title, tags and its filled STAR parts', () => {
    expect(
      storyText(story('Faster load', { tags: ['SQL'], situation: '4 h load', result: '40 min' })),
    ).toBe('- Faster load [SQL]\n  Situation: 4 h load\n  Result: 40 min');
    expect(storyText(story('Plain'))).toBe('- Plain');
  });

  it('picks the stories that show the most of the job’s skills, then keeps your order', () => {
    const stories = [
      story('Team lead', { tags: ['leadership'] }),
      story('Pipeline', { tags: ['Airflow'], action: 'Wrote dbt models' }),
      story('Dashboard', { action: 'Built it in Power BI with SQL' }),
    ];
    expect(pickStories(stories, ['airflow', 'dbt', 'sql']).map((s) => s.title)).toEqual([
      'Pipeline',
      'Dashboard',
      'Team lead',
    ]);
    expect(pickStories(stories, [], 2).map((s) => s.title)).toEqual(['Team lead', 'Pipeline']);
  });

  it('adds the story bank to the interview prompt only when there is one', () => {
    expect(storiesPart([])).toBe('');
    expect(storiesPart(['- Faster load'])).toContain('My story bank');
    const input = {
      title: 'Data Engineer',
      company: 'Zalando',
      city: null,
      resumeLanguage: 'en' as const,
      germanLevel: null,
      languages: [],
      missingSkills: [],
      missingKeywords: [],
      resumeIn: 'en',
      mustAdd: [],
      otherSkills: [],
      resume: 'My resume',
      description: 'We use Airflow.',
      facts: [],
      savedAnswers: '',
      achievements: [],
      stories: ['- Faster load [Airflow]\n  Result: 40 min'],
      settings: { maxPages: 2, keepSections: false },
    };
    const prompt = buildInterviewPrompt(input);
    expect(prompt).toContain('my achievements and my stories below');
    expect(prompt).toContain('- Faster load [Airflow]');
    expect(buildInterviewPrompt({ ...input, stories: [] })).not.toContain('My story bank');
  });
});
