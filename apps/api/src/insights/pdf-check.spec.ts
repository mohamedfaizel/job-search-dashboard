import { describe, expect, it } from 'vitest';
import { textToPdf } from './pdf';
import { checkPdf, readPdf } from './pdf-check';
import { achievementLines } from './prompt';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${String(i)}`).join(' ');

const base = {
  text: `User Example\nuser@example.com\nFrontend Engineer | Acme\n01/2020 - today\nReact, GraphQL\n${words(100)}`,
  pages: 1,
  name: 'User Example',
  email: 'user@example.com',
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
        text: `User Example\nuser @ example.com ﬁnance\n01/2020 – today, 2018—2019\nReact\n${words(100)}`,
        pages: 3,
      }),
    ).toEqual([
      ['PAGES', '3/2'],
      ['DATES', '01/2020 – today, 2018—2019'],
      ['CHARACTERS', 'U+FB01'],
      ['SKILLS', 'graphql'],
    ]);
  });

  it('flags an image-only PDF and a missing e-mail', () => {
    expect(failing({ ...base, text: 'Scan', maxPages: 1 }).map(([code]) => code)).toEqual([
      'TEXT',
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
