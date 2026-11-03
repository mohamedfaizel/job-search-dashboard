import { describe, expect, it } from 'vitest';
import { buildMasterReviewPrompt, reviewResume } from './resume-review';

const RESUME = `USER EXAMPLE
Senior Frontend Engineer
Berlin, Germany | +49 151 1234567 | user@example.com | linkedin.com/in/user
German: B2 | Germany Opportunity Card (Chancenkarte)

PROFESSIONAL SUMMARY
Passionate, results-driven engineer.

ACHIEVEMENTS
• ~60%: processing moved client-side through a shared
  frontend solution.
• 55%: less 3D code → React Three Fiber in 1 week.

EXPERIENCE
Acme, Berlin                                    Aug 2022 – May 2026
• Built things.
• Built more things.
• Reviewed code.
• Mentored juniors.
• Wrote tests.
• Shipped features.
`;

const base = {
  text: RESUME,
  languages: ['German A2', 'English C1'],
  workPermit: '',
  achievements: '',
  maxPages: 2,
};

describe('master resume suggestions', () => {
  it('finds what to fix, most important first', () => {
    expect(reviewResume(base)).toEqual([
      { code: 'LEVEL', detail: 'German: B2 → A2' },
      { code: 'WORK_PERMIT', detail: 'Opportunity Card' },
      { code: 'DATES', detail: '2022 – May 2026' },
      { code: 'CLICHES', detail: 'passionate, results-driven' },
      { code: 'SYMBOLS', detail: '→' },
      { code: 'NUMBERS', detail: '2/8' },
      {
        code: 'ACHIEVEMENTS',
        detail:
          '~60%: processing moved client-side through a shared frontend solution.\n55%: less 3D code → React Three Fiber in 1 week.',
      },
    ]);
  });

  it('stays quiet when the profile already has it, and checks length and contact', () => {
    const long = `Name\nSkills\n${'word '.repeat(1000)}`;
    expect(
      reviewResume({ ...base, text: long, workPermit: 'Chancenkarte', achievements: 'x' }),
    ).toEqual([
      { code: 'CONTACT', detail: 'e-mail, phone, LinkedIn' },
      { code: 'LENGTH', detail: '1002/3/2' },
    ]);
    expect(reviewResume({ ...base, text: long, maxPages: 3 }).map((s) => s.code)).toEqual([
      'CONTACT',
    ]);
    expect(reviewResume({ ...base, text: ' ' })).toEqual([]);
  });

  it('writes a recruiter review prompt with your real levels and page limit', () => {
    const prompt = buildMasterReviewPrompt({ ...base, maxPages: 3 });
    expect(prompt).toContain('fit 3 pages');
    expect(prompt).toContain('German A2, English C1');
    expect(prompt).toContain('never invent one');
    expect(prompt).toContain('USER EXAMPLE');
  });
});
