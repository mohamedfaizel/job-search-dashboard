import { describe, expect, it } from 'vitest';
import { buildLetterPrompt, readLetter } from './letter';

const BASE = {
  language: 'en',
  job: { title: 'Frontend Engineer', company: 'Acme', description: 'We use GraphQL.' },
  resume: '# Ada\n\n## Experience\n- Built things',
  letter: '',
  mustAdd: [] as string[],
  achievements: [] as string[],
  instruction: '',
};

describe('buildLetterPrompt', () => {
  it('asks for a first letter from the resume and the job ad, with the honesty rules', () => {
    const prompt = buildLetterPrompt(BASE);
    expect(prompt).toContain('Please write my English cover letter');
    expect(prompt).toContain('"Frontend Engineer" at Acme');
    expect(prompt).toContain('Never invent a skill');
    expect(prompt).toContain('Start with the greeting and end with the sign-off');
    expect(prompt).toContain('Built things');
    expect(prompt).toContain('We use GraphQL.');
    expect(prompt).not.toContain('My letter now');
    expect(prompt).not.toContain('may mention them');
  });

  it('improves the letter you have, in German, with ticked terms, true lines and your wish', () => {
    const prompt = buildLetterPrompt({
      ...BASE,
      language: 'de',
      letter: 'Sehr geehrte Damen und Herren,\n\nich bewerbe mich.',
      mustAdd: ['GraphQL'],
      achievements: ['Ladezeit um 40% gesenkt'],
      instruction: 'Kürzer',
    });
    expect(prompt).toContain('Please improve my German cover letter');
    expect(prompt).toContain('My letter now');
    expect(prompt).toContain('ich bewerbe mich.');
    expect(prompt).toContain('may mention them where they fit, in my own words: GraphQL');
    expect(prompt).toContain('- Ladezeit um 40% gesenkt');
    expect(prompt).toContain('Also: Kürzer');
  });
});

describe('readLetter', () => {
  it('reads a reply as paragraphs, without a code fence', () => {
    expect(readLetter('```\nDear team,\n\nI like this role.\n\nBest,\nAda\n```')).toBe(
      'Dear team,\n\nI like this role.\n\nBest,\nAda',
    );
  });

  it('is empty when there is nothing in the reply', () => {
    expect(readLetter('  \n\n ')).toBe('');
  });
});
