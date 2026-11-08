import { describe, expect, it } from 'vitest';
import type { BuilderSection } from './builder-doc';
import { buildImprovePrompt, readSuggestion, sectionMarkdown } from './improve-section';

const SECTION: BuilderSection = {
  id: 'exp',
  title: 'Experience',
  hidden: false,
  blocks: [
    {
      id: 'e1',
      kind: 'entry',
      title: 'Frontend Engineer',
      org: 'Acme GmbH',
      meta: 'Berlin | 01/2021 - today',
      bullets: ['Built dashboards'],
      lines: [],
    },
  ],
};

describe('sectionMarkdown', () => {
  it('writes one section in the layout, without the header', () => {
    expect(sectionMarkdown(SECTION)).toBe(
      '## Experience\n\n### Frontend Engineer | Acme GmbH\nBerlin | 01/2021 - today\n- Built dashboards',
    );
  });

  it('is empty for a section with nothing in it', () => {
    expect(sectionMarkdown({ ...SECTION, blocks: [] })).toBe('');
  });
});

describe('buildImprovePrompt', () => {
  it('asks for the same facts, lists only terms you ticked and carries the job ad', () => {
    const prompt = buildImprovePrompt({
      section: sectionMarkdown(SECTION),
      language: 'en',
      job: { title: 'Frontend Engineer', company: 'Acme', description: 'We use GraphQL.' },
      mustAdd: ['GraphQL'],
      achievements: ['Cut load time by 40%'],
      instruction: 'Make it shorter',
    });
    expect(prompt).toContain('Never invent a skill');
    expect(prompt).toContain('may use them where they fit, in my own words: GraphQL');
    expect(prompt).toContain('- Cut load time by 40%');
    expect(prompt).toContain('We use GraphQL.');
    expect(prompt).toContain('Also: Make it shorter');
    expect(prompt).toContain('Built dashboards');
  });

  it('writes the master prompt in German without a job', () => {
    const prompt = buildImprovePrompt({
      section: '## Profil\n\nText',
      language: 'de',
      job: null,
      mustAdd: [],
      achievements: [],
      instruction: '',
    });
    expect(prompt).toContain('German resume.');
    expect(prompt).not.toContain('The job ad');
    expect(prompt).not.toContain('may use them');
  });
});

describe('readSuggestion', () => {
  it('reads a reply into the same section, keeping its id and title', () => {
    const reply =
      '```markdown\n## Berufserfahrung\n\n### Frontend Engineer | Acme GmbH\nBerlin | 01/2021 - today\n- Built fast dashboards\n```';
    const out = readSuggestion(reply, SECTION);
    expect(out).toMatchObject({ id: 'exp', title: 'Experience', hidden: false });
    expect(sectionMarkdown(out!)).toContain('- Built fast dashboards');
  });

  it('accepts content without a section line', () => {
    const out = readSuggestion('A short summary of me.', {
      ...SECTION,
      id: 'sum',
      title: 'Summary',
    });
    expect(out?.blocks).toHaveLength(1);
    expect(out?.title).toBe('Summary');
  });

  it('gives null for an empty reply', () => {
    expect(readSuggestion('  \n ', SECTION)).toBeNull();
    expect(readSuggestion('```\n```', SECTION)).toBeNull();
  });
});
