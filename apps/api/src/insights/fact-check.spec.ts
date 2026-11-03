import { describe, expect, it } from 'vitest';
import { factCheck, numberKey, skillItems } from './fact-check';

const MASTER = `# Mohamed Faizel
Frontend Engineer

## Experience
### Frontend Engineer | Acme GmbH
Berlin | 01/2021 – today
- Built a React design system used by 12 teams
- Cut page load time by 35%

## Skills
React, TypeScript, Node.js, GraphQL

## Languages
German (A2), English (C1)
`;

const check = (resume: string, over: Partial<Parameters<typeof factCheck>[0]> = {}) =>
  factCheck({
    resume,
    coverLetter: '',
    sources: [MASTER, 'react\ntypescript\nstorybook', 'German A2'],
    jobSkills: [],
    ...over,
  });

describe('numberKey', () => {
  it('gives one spelling to the same number', () => {
    expect(numberKey('50.000')).toBe('50000');
    expect(numberKey('50,000')).toBe('50000');
    expect(numberKey('1,5')).toBe('1.5');
    expect(numberKey('40 %')).toBe('40%');
    expect(numberKey('7+')).toBe('7');
    expect(numberKey('10K')).toBe('10k');
  });
});

describe('factCheck numbers', () => {
  it('accepts numbers that are in your resume, however the date is written', () => {
    const resume = `# Me
## Experience
### Frontend Engineer | Acme GmbH
Jan 2021 – today
- Built a React design system used by 12 teams
- Cut page load time by 35%
`;
    expect(check(resume)).toEqual([]);
  });

  it('flags a number that is not in your resume, with the line it is in', () => {
    const resume = `# Me
## Experience
- Cut page load time by 60% and served 2.5M users
`;
    expect(check(resume)).toEqual([
      expect.objectContaining({
        kind: 'NUMBER',
        text: '60%',
        where: 'RESUME',
        context: 'Cut page load time by 60% and served 2.5M users',
      }),
      expect.objectContaining({ kind: 'NUMBER', text: '2.5M' }),
    ]);
  });

  it('flags an invented date, but not a month of a known year', () => {
    const resume = `## Experience
Berlin | 03/2019 – 04/2021
Berlin | 03/2021 – today
`;
    const found = check(resume).map((f) => f.text);
    expect(found).toEqual(['2019']);
  });

  it('ignores bare single digits, but not years of experience', () => {
    expect(check('- Top 3 in the team\n- Led 4 people')).toEqual([]);
    expect(check('Frontend engineer with 8+ years of experience')).toEqual([
      expect.objectContaining({ kind: 'NUMBER', text: '8+' }),
    ]);
  });

  it('accepts years of experience from your profile', () => {
    const found = check('Frontend engineer with 8+ years of experience', {
      sources: [MASTER, '8 years'],
    });
    expect(found).toEqual([]);
  });

  it('does not take part of a word for a number, or read contact details', () => {
    const resume = `# Me
Berlin | +49 151 23456789 | me@example.com
- Wrote ES6 modules and used B2B tools
`;
    expect(check(resume)).toEqual([]);
  });

  it('checks the cover letter too', () => {
    const found = check('- fine', { coverLetter: 'I raised revenue by 45% at my last job.' });
    expect(found).toEqual([
      expect.objectContaining({ kind: 'NUMBER', text: '45%', where: 'COVER_LETTER' }),
    ]);
  });

  it('reports a number once however often it appears', () => {
    expect(check('- up 99%\n- again 99%')).toHaveLength(1);
  });
});

describe('factCheck language levels', () => {
  it('flags a level you never claimed', () => {
    const resume = '## Languages\nGerman (B2), English (C1)\n';
    expect(check(resume)).toEqual([
      expect.objectContaining({ kind: 'LEVEL', text: 'B2', context: 'German (B2), English (C1)' }),
    ]);
  });

  it('accepts the levels in your profile', () => {
    expect(check('## Languages\nGerman (A2), English (C1)')).toEqual([]);
  });
});

describe('skillItems', () => {
  it('reads the items of the skills section, without labels or years', () => {
    const resume = `## Technical Skills
- Frontend: React, **Vue.js** (4 years)
- Tools: Docker; Git
## Languages
German, English
## Skills
Agile Methods in large international enterprise teams
`;
    expect(skillItems(resume)).toEqual(['React', 'Vue.js', 'Docker', 'Git']);
  });

  it('reads German section titles', () => {
    expect(skillItems('## Kenntnisse\nReact, Jira')).toEqual(['React', 'Jira']);
  });
});

describe('factCheck skills', () => {
  it('flags skills in the skills section that you never claimed', () => {
    const resume = `## Skills
React, TypeScript, Kubernetes, Storybook
`;
    expect(check(resume)).toEqual([
      expect.objectContaining({
        kind: 'SKILL',
        text: 'Kubernetes',
        where: 'RESUME',
        context: 'React, TypeScript, Kubernetes, Storybook',
      }),
    ]);
  });

  it('accepts another spelling or a plural of a skill you have', () => {
    const resume = '## Skills\nReactJS, Type-Script, Node, GraphQL APIs\n';
    expect(check(resume, { sources: [MASTER, 'react\ntypescript\ngraphql api'] })).toEqual([]);
  });

  it('flags a skill of the job that the resume names in its text', () => {
    const resume = `## Experience
- Migrated the build to Webpack and ran it on Kubernetes
`;
    const found = check(resume, { jobSkills: ['kubernetes', 'webpack', 'react', 'rust'] });
    expect(found.map((f) => f.text)).toEqual(['kubernetes', 'webpack']);
    expect(found[0]?.context).toContain('Kubernetes');
  });

  it('accepts a skill from your profile skills', () => {
    const resume = '## Skills\nStorybook\n';
    expect(check(resume)).toEqual([]);
  });
});
