import { describe, expect, it } from 'vitest';
import { textToPdf } from './pdf';
import { checkPdf, readPdf } from './pdf-check';
import { achievementLines } from './prompt';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${String(i)}`).join(' ');

const base = {
  text: `User Example\nuser@example.com\nFrontend Engineer | Acme\n01/2020 - today\nReact, GraphQL\n${words(100)}`,
  pages: 1,
  name: 'User Example',
  emails: ['user@example.com'],
  maxPages: 2,
  skills: ['react', 'graphql'],
};

const failing = (input: Parameters<typeof checkPdf>[0]) =>
  checkPdf(input)
    .filter((item) => !item.ok)
    .map((item) => [item.code, item.detail]);

describe('PDF check', () => {
  it('passes a clean one-page resume', () => {
    expect(failing(base)).toEqual([]);
  });

  it('finds what an ATS would trip over', () => {
    expect(
      failing({
        ...base,
        text: `User Example\nuser @ example.com ﬁnance\n01/2020 – today, 2018—2019, Jan 2022 – Aug 2022\nAnna University (fill in) - 2013\nReact\n${words(100)}`,
        pages: 3,
      }),
    ).toEqual([
      ['PAGES', '3/2'],
      ['DATES', '01/2020 – today, 2018—2019, 2022 – Aug 2022'],
      ['CHARACTERS', 'U+FB01'],
      ['PLACEHOLDERS', '(fill in)'],
      ['SKILLS', 'graphql'],
    ]);
  });

  it('checks the name and e-mail the resume itself uses, not the account ones', () => {
    const text = `MOHAMED EXAMPLE M\nme.js @ example.com\n${words(100)}`;
    expect(
      failing({
        ...base,
        text,
        name: 'Mohamed Example M',
        emails: ['me.js@example.com'],
        skills: [],
      }),
    ).toEqual([]);
    expect(
      failing({
        ...base,
        text,
        name: 'Mohamed Example Abdullah',
        emails: ['other@example.com'],
        skills: [],
      }),
    ).toEqual([
      ['NAME', 'Mohamed Example Abdullah'],
      ['EMAIL', 'other@example.com'],
    ]);
  });

  it('flags an image-only PDF and a missing e-mail', () => {
    expect(failing({ ...base, text: 'Scan', maxPages: 1 }).map(([code]) => code)).toEqual([
      'TEXT',
      'NAME',
      'EMAIL',
      'SKILLS',
    ]);
  });

  it('reads the text layer of a real PDF', async () => {
    const pdf = await textToPdf(base.text, 'User – Resume');
    const read = await readPdf(pdf);
    expect(read.pages).toBe(1);
    expect(failing({ ...base, ...read })).toEqual([]);
  });
});

describe('achievements bank', () => {
  it('keeps one fact per line, without list marks', () => {
    expect(achievementLines('- Cut costs by 20%\n\n• Led 5 people\n2. Shipped v2\n  ')).toEqual([
      'Cut costs by 20%',
      'Led 5 people',
      'Shipped v2',
    ]);
  });
});
