import { describe, expect, it } from 'vitest';
import {
  buildDesignPrompt,
  DEFAULT_DESIGN,
  DesignReplyError,
  parseDesign,
  toDesign,
} from './my-design';
import { parseResume } from './resume-doc';
import { resumeTex } from './templates';

const REPLY = `Here is the design of your resume:
\`\`\`json
{
  "font": "serif",
  "accent": "#1e3a5f",
  "nameSize": "huge",
  "nameStyle": "caps",
  "nameColour": "accent",
  "align": "center",
  "headingStyle": "bar",
  "headingCase": "upper",
  "headingColour": "black",
  "dates": "right",
  "companyFirst": true,
  "density": "compact",
  "skillsFirst": true,
  "photo": true,
  "twoColumns": true
}
\`\`\``;

describe('My design', () => {
  it('asks Claude for every setting, as JSON only', () => {
    const prompt = buildDesignPrompt();
    expect(prompt).toContain('I attached my resume');
    for (const key of Object.keys(DEFAULT_DESIGN)) expect(prompt).toContain(`"${key}":`);
    expect(prompt).toContain('Reply with only this JSON');
  });

  it('reads a reply in a code fence, with "center" spelled the American way', () => {
    expect(parseDesign(REPLY)).toEqual({
      font: 'serif',
      accent: '1E3A5F',
      nameSize: 'huge',
      nameStyle: 'caps',
      nameColour: 'accent',
      align: 'centre',
      headingStyle: 'bar',
      headingCase: 'upper',
      headingColour: 'black',
      dates: 'right',
      companyFirst: true,
      density: 'compact',
      skillsFirst: true,
      photo: true,
      twoColumns: true,
    });
  });

  it('uses the default for a wrong or missing value, and never takes LaTeX', () => {
    const d = parseDesign('{"font": "\\\\input{/etc/passwd}", "accent": "red", "photo": "yes"}');
    expect(d.font).toBe('sans');
    expect(d.accent).toBe(DEFAULT_DESIGN.accent);
    expect(d.photo).toBe(false);
    expect(toDesign(null)).toEqual(DEFAULT_DESIGN);
  });

  it('refuses a reply without JSON', () => {
    expect(() => parseDesign('Sorry, I cannot see a file.')).toThrow(DesignReplyError);
    expect(() => parseDesign('{ not json }')).toThrow(DesignReplyError);
  });

  it('typesets a resume in My design', () => {
    const doc = parseResume(
      '# Jane Doe\n## Experience\n### Dev | Acme\nBerlin | 01/2020 - today\n- Built it.\n## Skills\n- React',
      'X',
    );
    const look = {
      template: 'design' as const,
      design: parseDesign(REPLY),
      accent: '1E3A5F',
      font: 'auto' as const,
      photo: null,
      language: 'en',
    };
    const tex = resumeTex(doc, look);
    expect(tex).toContain('TeX Gyre Pagella');
    expect(tex).toContain('\\definecolor{accent}{HTML}{1E3A5F}');
    expect(tex).toContain('\\MakeUppercase{Jane Doe}');
    expect(tex).toContain('\\begin{center}');
    // Company first, dates on the right, Skills before Experience.
    expect(tex).toContain('\\textbf{Acme}\\hfill{\\small\\color{muted}Berlin | 01/2020 - today}');
    expect(tex.indexOf('Skills')).toBeLessThan(tex.indexOf('Experience'));
    expect(tex).not.toContain('etc/passwd');
  });
});
