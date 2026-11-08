import { describe, expect, it } from 'vitest';
import { parseResume } from '../documents/resume-doc';
import type { BuilderDoc } from './builder-doc';
import {
  BuilderDocError,
  emptyDoc,
  isLanguagesSection,
  lockLanguages,
  plainToMarkdown,
  readBuilderDoc,
  structurePrompt,
  textToBuilderDoc,
  toMarkdown,
} from './builder-doc';

const MARKDOWN = `# Mohamed Faizel
Senior Frontend Engineer
Berlin | me@example.com | linkedin.com/in/me

## Summary
Frontend engineer with 8 years in React.

## Experience
### Senior Frontend Engineer | Acme GmbH
Berlin | 01/2021 - today
- Cut page load time by 40%
- Built the design system

## Skills
- **Frontend:** React, TypeScript

## Languages
- English C1
- German B2
`;

describe('textToBuilderDoc', () => {
  it('reads the Markdown layout into sections and entries', () => {
    const doc = textToBuilderDoc(MARKDOWN, 'Fallback');
    expect(doc.name).toBe('Mohamed Faizel');
    expect(doc.headline).toBe('Senior Frontend Engineer');
    expect(doc.contact).toEqual(['Berlin', 'me@example.com', 'linkedin.com/in/me']);
    expect(doc.sections.map((s) => s.title)).toEqual([
      'Summary',
      'Experience',
      'Skills',
      'Languages',
    ]);
    const entry = doc.sections[1]?.blocks[0];
    expect(entry).toMatchObject({
      kind: 'entry',
      title: 'Senior Frontend Engineer',
      org: 'Acme GmbH',
      meta: 'Berlin | 01/2021 - today',
      bullets: ['Cut page load time by 40%', 'Built the design system'],
    });
  });

  it('finds sections in plain text from an uploaded file', () => {
    const doc = textToBuilderDoc(
      `Jane Doe
Product Designer
jane@example.com | +49 151 1234567
PROFILE
Designer who ships.
Berufserfahrung
• Led the redesign
• Ran user tests`,
      'Fallback',
    );
    expect(doc.name).toBe('Jane Doe');
    expect(doc.headline).toBe('Product Designer');
    expect(doc.sections.map((s) => s.title)).toEqual(['PROFILE', 'Berufserfahrung']);
    expect(doc.sections[1]?.blocks[0]).toMatchObject({
      kind: 'bullets',
      items: ['Led the redesign', 'Ran user tests'],
    });
  });

  it('reads jobs with a dates line under them into entries', () => {
    const doc = textToBuilderDoc(
      `Jane Doe
jane@example.com
EXPERIENCE
Senior Engineer | Acme GmbH
Berlin | 01/2021 - today
• Cut load time by 40%
Developer, Blue Labs
2016 – 2020
SKILLS
React | TypeScript`,
      'x',
    );
    expect(doc.sections[0]?.blocks).toMatchObject([
      {
        kind: 'entry',
        title: 'Senior Engineer',
        org: 'Acme GmbH',
        meta: 'Berlin | 01/2021 - today',
        bullets: ['Cut load time by 40%'],
      },
      { kind: 'entry', title: 'Developer, Blue Labs', meta: '2016 - 2020' },
    ]);
    // No dates under it: a skills line stays a line.
    expect(doc.sections[1]?.blocks[0]).toMatchObject({ kind: 'paragraph' });
  });

  it('starts with the usual sections in the resume language when there is no text', () => {
    expect(textToBuilderDoc('  ', 'Jane').sections.length).toBeGreaterThan(0);
    expect(emptyDoc('Jane', 'de').sections.map((s) => s.title)).toContain('Berufserfahrung');
  });
});

describe('toMarkdown', () => {
  it('writes text the PDF templates read back the same way', () => {
    const doc = textToBuilderDoc(MARKDOWN, 'Fallback');
    const again = parseResume(toMarkdown(doc), 'Fallback');
    expect(again).toEqual(parseResume(MARKDOWN, 'Fallback'));
  });

  it('leaves out hidden sections, empty lines and empty sections', () => {
    const doc: BuilderDoc = {
      name: 'Jane',
      headline: '',
      contact: ['', 'jane@example.com'],
      sections: [
        {
          id: 'a',
          title: 'Hobbies',
          hidden: true,
          blocks: [{ id: 'b', kind: 'paragraph', text: 'Chess' }],
        },
        { id: 'c', title: 'Projects', hidden: false, blocks: [] },
        {
          id: 'd',
          title: 'Skills',
          hidden: false,
          blocks: [{ id: 'e', kind: 'bullets', items: ['React', ' ', 'Next.js\nApp Router'] }],
        },
      ],
    };
    expect(toMarkdown(doc)).toBe(
      '# Jane\njane@example.com\n\n## Skills\n\n- React\n- Next.js App Router\n',
    );
  });
});

describe('lockLanguages', () => {
  it('always shows the languages from My profile, so German A2 never becomes B2', () => {
    const doc = lockLanguages(textToBuilderDoc(MARKDOWN, 'x'), ['English C1', 'German A2']);
    expect(toMarkdown(doc)).toContain('- English C1\n- German A2');
    expect(toMarkdown(doc)).not.toContain('B2');
  });

  it('keeps the section as written without languages on My profile', () => {
    const doc = textToBuilderDoc(MARKDOWN, 'x');
    expect(lockLanguages(doc, [])).toBe(doc);
  });

  it('knows the section in German too', () => {
    expect(isLanguagesSection('Sprachkenntnisse')).toBe(true);
    expect(isLanguagesSection('Skills')).toBe(false);
  });
});

describe('readBuilderDoc', () => {
  it('keeps a valid doc and drops unknown fields', () => {
    const doc = textToBuilderDoc(MARKDOWN, 'x');
    const read = readBuilderDoc(JSON.stringify({ ...doc, extra: 1 }));
    expect(read).toEqual(doc);
  });

  it('refuses text that is not a resume', () => {
    expect(() => readBuilderDoc('nope')).toThrow(BuilderDocError);
    expect(() => readBuilderDoc('{"name":"x"}')).toThrow(BuilderDocError);
  });

  it('drops blocks of unknown kinds and gives bad ids new ones', () => {
    const read = readBuilderDoc(
      JSON.stringify({
        sections: [{ id: '<b>', title: 'X', blocks: [{ kind: 'video' }, { kind: 'paragraph' }] }],
      }),
    );
    expect(read.sections[0]?.id).toMatch(/^[\w-]+$/);
    expect(read.sections[0]?.blocks).toEqual([
      { id: expect.any(String) as string, kind: 'paragraph', text: '' },
    ]);
  });
});

describe('plainToMarkdown and structurePrompt', () => {
  it('does not take sentences for section titles', () => {
    expect(plainToMarkdown('Jane\nI LOVE CODE.\nSkills:')).toBe(
      '# Jane\nI LOVE CODE.\n\n## Skills',
    );
  });

  it('asks the AI chat to keep every word and includes the resume', () => {
    const prompt = structurePrompt('Jane Doe\nSkills', 'de');
    expect(prompt).toContain('Do not change');
    expect(prompt).toContain('Berufserfahrung');
    expect(prompt).toContain('Jane Doe');
  });
});
