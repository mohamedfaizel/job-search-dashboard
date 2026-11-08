import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { textToPdf } from '../insights/pdf';
import { cityOf } from './documents.service';
import { contactItem, esc, inline } from './latex';
import { cleanPdf } from './pdf-metadata';
import { asciiDates, letterParagraphs, parseResume } from './resume-doc';
import {
  coverLetterTex,
  hexColor,
  letterDate,
  RESUME_TEMPLATES,
  resumeTex,
  templateSizes,
  toLayout,
} from './templates';

const RESUME = `\`\`\`markdown
# Mohamed Faizel
Senior Frontend Engineer
Aachen, Germany | +49 151 2345678 | me@example.com | linkedin.com/in/me

## Summary
Frontend engineer with **8 years** of React.

## Skills
- **Frontend:** React, TypeScript, Figma

## Berufserfahrung
### Senior Frontend Engineer | Wayne GmbH
Aachen | 01/2021 – heute
- Built a dashboard used by 40 teams.

**LANGUAGES**
- German: A2
\`\`\``;

describe('parseResume', () => {
  it('reads name, headline, contact, sections and entries', () => {
    const doc = parseResume(RESUME, 'Fallback');
    expect(doc.name).toBe('Mohamed Faizel');
    expect(doc.headline).toBe('Senior Frontend Engineer');
    expect(doc.contact).toEqual([
      'Aachen, Germany',
      '+49 151 2345678',
      'me@example.com',
      'linkedin.com/in/me',
    ]);
    expect(doc.sections.map((s) => s.title)).toEqual([
      'Summary',
      'Skills',
      'Berufserfahrung',
      'LANGUAGES',
    ]);
    expect(doc.sections[2]?.blocks[0]).toEqual({
      kind: 'entry',
      title: 'Senior Frontend Engineer',
      org: 'Wayne GmbH',
      meta: 'Aachen | 01/2021 - heute',
      bullets: ['Built a dashboard used by 40 teams.'],
      lines: [],
    });
    expect(doc.sections[1]?.blocks[0]).toEqual({
      kind: 'bullets',
      items: ['**Frontend:** React, TypeScript, Figma'],
    });
  });

  it('keeps text that does not follow the layout', () => {
    const doc = parseResume('Just a paragraph\nwith two lines.\n\n- and a bullet', 'Ada');
    expect(doc.name).toBe('Ada');
    expect(doc.sections).toEqual([
      {
        title: '',
        blocks: [
          { kind: 'paragraph', text: 'Just a paragraph with two lines.' },
          { kind: 'bullets', items: ['and a bullet'] },
        ],
      },
    ]);
  });
});

it('drops a "Headline:" label Claude kept from the prompt', () => {
  expect(parseResume('# Jane\nHeadline: Frontend Developer\nBerlin | j@x.de', 'X').headline).toBe(
    'Frontend Developer',
  );
});

describe('asciiDates', () => {
  it('puts a plain hyphen in date ranges, so ATS imports keep the end date', () => {
    expect(asciiDates('Berlin | 01/2019 – 02/2022')).toBe('Berlin | 01/2019 - 02/2022');
    expect(asciiDates('2016—2024')).toBe('2016 - 2024');
    expect(asciiDates('03/2022 – today')).toBe('03/2022 - today');
    expect(asciiDates('EUR 600k–1M')).toBe('EUR 600k–1M');
  });

  it('is used for the date line of each entry', () => {
    const doc = parseResume(
      '# Jane\n## Experience\n### Dev | Acme\nBerlin | 01/2019 – 02/2022',
      'x',
    );
    const entry = doc.sections[0]?.blocks[0];
    expect(entry?.kind === 'entry' && entry.meta).toBe('Berlin | 01/2019 - 02/2022');
  });
});

describe('LaTeX escaping', () => {
  it('escapes every LaTeX special character, so text can never run LaTeX code', () => {
    expect(esc('100% & C# ~ $5 {x} a_b ^ \\input{/etc/passwd}')).toBe(
      '100\\% \\& C\\# \\textasciitilde{} \\$5 \\{x\\} a\\_b \\textasciicircum{} \\textbackslash{}input\\{/etc/passwd\\}',
    );
  });

  it('drops invisible characters, so nothing hidden reaches the PDF', () => {
    expect(esc('Re\u200bact\ufeff')).toBe('React');
  });

  it('keeps bold, italics and web links from Markdown', () => {
    expect(inline('**8 years** of *React* at [Acme](https://acme.dev/a_b)')).toBe(
      '\\textbf{8 years} of \\emph{React} at \\href{https://acme.dev/a_b}{Acme}',
    );
    // Only web and mail links are clickable.
    expect(inline('[x](javascript:alert)')).toBe('x');
  });

  it('links an email or a web address in the contact line', () => {
    expect(contactItem('me@example.com')).toBe('\\href{mailto:me@example.com}{me@example.com}');
    expect(contactItem('linkedin.com/in/me')).toBe(
      '\\href{https://linkedin.com/in/me}{linkedin.com/in/me}',
    );
    expect(contactItem('+49 151 2345678')).toBe('+49 151 2345678');
  });
});

describe('templates', () => {
  const look = {
    template: 'modern' as const,
    accent: '#0e7c66',
    font: 'auto' as const,
    photo: null,
    language: 'en',
  };

  it('builds each template with your colour and font, and no hidden text', () => {
    const doc = parseResume(RESUME, 'X');
    const modern = resumeTex(doc, look);
    expect(modern).toContain('\\definecolor{accent}{HTML}{0E7C66}');
    expect(modern).toContain('\\setmainfont{TeX Gyre Heros}');
    expect(modern).toContain('\\textbf{Senior Frontend Engineer}');
    expect(resumeTex(doc, { ...look, template: 'classic' })).toContain('TeX Gyre Pagella');
    expect(resumeTex(doc, { ...look, template: 'classic', font: 'sans' })).toContain(
      'TeX Gyre Heros',
    );
    for (const { id: template } of RESUME_TEMPLATES) {
      const tex = resumeTex(doc, { ...look, template });
      expect(tex).toContain('\\begin{document}');
      expect(tex).toContain('Senior Frontend Engineer');
      // No white or tiny text: nothing a reader can't see.
      expect(tex).not.toMatch(/\\color\{white\}|\\tiny|\\phantom/);
      expect(tex.toLowerCase()).not.toContain('latex');
    }
    expect(resumeTex(doc, { ...look, photo: 'photo.jpg' })).toContain(
      '\\includegraphics[width=2.8cm,height=3.6cm,keepaspectratio]{photo.jpg}',
    );
  });

  it('has the career-ops looks, each with its own type and colour rules', () => {
    const doc = parseResume(RESUME, 'X');
    expect(RESUME_TEMPLATES.map((t) => t.id)).toEqual([
      'classic',
      'modern',
      'compact',
      'sharp',
      'bold',
      'executive',
      'leadership',
      'jake',
      'ats',
    ]);
    expect(resumeTex(doc, { ...look, template: 'jake' })).toContain('Latin Modern Roman');
    expect(resumeTex(doc, { ...look, template: 'executive' })).toContain('TeX Gyre Pagella');
    // Executive, Jake and ATS plain have no colour, whatever accent you picked.
    for (const template of ['executive', 'jake', 'ats'] as const) {
      expect(resumeTex(doc, { ...look, template })).toContain(
        '\\definecolor{accent}{HTML}{222222}',
      );
    }
    // Jake and ATS plain never show a photo.
    for (const template of ['jake', 'ats'] as const) {
      expect(resumeTex(doc, { ...look, template, photo: 'photo.jpg' })).not.toContain('photo.jpg');
    }
    expect(resumeTex(doc, { ...look, template: 'bold' })).toContain('\\colorbox{accent!8}');
  });

  it('puts Skills before Experience in Leadership only', () => {
    const doc = parseResume(
      '# Jane\n## Summary\nHi.\n## Experience\n### Lead | Acme\n- Led 9 people.\n## Skills\n- Hiring',
      'X',
    );
    const order = (tex: string) => tex.indexOf('Skills') < tex.indexOf('Experience');
    expect(order(resumeTex(doc, { ...look, template: 'leadership' }))).toBe(true);
    expect(order(resumeTex(doc, { ...look, template: 'modern' }))).toBe(false);
  });

  it('puts Jake dates on the right and the city under them', () => {
    const doc = parseResume('# Jane\n## Experience\n### Dev | Acme\nBerlin | 01/2020 - today', 'X');
    const tex = resumeTex(doc, { ...look, template: 'jake' });
    expect(tex).toContain('\\textbf{Acme}\\hfill 01/2020 - today\\par');
    expect(tex).toContain('\\textit{Dev}\\hfill{\\small\\textit{Berlin}}');
  });

  it('applies your text size, margins, line spacing and compact mode', () => {
    const doc = parseResume(RESUME, 'X');
    const plain = resumeTex(doc, { ...look, template: 'classic' });
    expect(plain).toContain('left=2cm,right=2cm,top=1.6cm,bottom=1.6cm');
    expect(plain).not.toContain('\\linespread');
    expect(plain).not.toContain('\\renewcommand\\normalsize');

    const layout = toLayout({ fontSize: 9.5, margin: 12, lineSpacing: 1.2, compact: true });
    const tex = resumeTex(doc, { ...look, template: 'classic', layout });
    expect(tex).toContain('left=12mm,right=12mm,top=12mm,bottom=12mm');
    expect(tex).toContain('\\linespread{1.2}');
    expect(tex).toContain('\\renewcommand\\normalsize{\\fontsize{9.5}{11.4}\\selectfont}');
    expect(tex).toContain('itemsep=0pt,parsep=0pt,topsep=1pt');
    // Classic's 7pt gap between jobs is halved.
    expect(tex).toContain('\\vspace{3.5pt}');

    const spacingOnly = resumeTex(doc, {
      ...look,
      layout: toLayout({ lineSpacing: 1.1 }),
    });
    expect(spacingOnly).toContain('\\linespread{1.1}');
    expect(spacingOnly).not.toContain('\\renewcommand\\normalsize');
    expect(spacingOnly).toContain('left=1.9cm');
  });

  it('keeps the sliders inside readable limits', () => {
    expect(toLayout({})).toEqual({
      fontSize: null,
      margin: null,
      lineSpacing: 1,
      compact: false,
      skillsStyle: 'index',
      skillsBold: true,
      headingStyle: 'auto',
      datesSide: 'auto',
      bulletStyle: 'dot',
    });
    expect(toLayout({ fontSize: 4, margin: 99, lineSpacing: 3, compact: true })).toMatchObject({
      fontSize: 9,
      margin: 25,
      lineSpacing: 1.4,
      compact: true,
    });
    // Unknown choices go back to the defaults.
    expect(toLayout({ skillsStyle: 'x', headingStyle: '}', bulletStyle: 'star' })).toMatchObject({
      skillsStyle: 'index',
      headingStyle: 'auto',
      bulletStyle: 'dot',
    });
    expect(toLayout({ fontSize: 10.3, margin: 14.6, lineSpacing: 1.17 })).toMatchObject({
      fontSize: 10.5,
      margin: 15,
      lineSpacing: 1.15,
    });
    expect(toLayout({ fontSize: Number.NaN })).toMatchObject({ fontSize: null });
    expect(templateSizes('compact')).toEqual({ fontSize: 10, margin: 15 });
    expect(templateSizes('design')).toBeNull();
  });

  it('sets Skills lines as a bold-label index in one block', () => {
    const doc = parseResume(
      '# Jane\n## Technical Skills\nLanguages : JavaScript, TypeScript\n\n**Frontend**: React, Vue\n\nPlain line without a label',
      'X',
    );
    const tex = resumeTex(doc, { ...look, layout: toLayout({}) });
    expect(tex).toContain('\\begin{minipage}{\\linewidth}');
    expect(tex).toContain('\\makebox[\\skillw][l]{\\textbf{Languages}}JavaScript, TypeScript');
    expect(tex).toContain('\\makebox[\\skillw][l]{\\textbf{Frontend}}React, Vue');
    expect(tex).toContain('Plain line without a label\\par');
    expect(tex).not.toContain('\\begin{tabular');

    const lines = resumeTex(doc, { ...look, layout: toLayout({ skillsStyle: 'lines' }) });
    expect(lines).toContain('\\textbf{Languages}: JavaScript, TypeScript\\par');
    expect(lines).not.toContain('\\makebox[\\skillw]');

    const light = resumeTex(doc, { ...look, layout: toLayout({ skillsBold: false }) });
    expect(light).not.toContain('\\textbf{Languages}');

    const plain = resumeTex(doc, { ...look, layout: toLayout({ skillsStyle: 'plain' }) });
    expect(plain).not.toContain('\\begin{minipage}');
    // A Skills section with no "Label: list" line is set as written.
    const none = parseResume('# Jane\n## Skills\n- React\n- Vue', 'X');
    expect(resumeTex(none, { ...look, layout: toLayout({}) })).toContain('\\item React');
  });

  it('applies your bullet, heading and date choices', () => {
    const doc = parseResume(
      '# Jane\n## Experience\n### Dev | Acme\nBerlin | 01/2020 - today\n- Built it',
      'X',
    );
    const tex = resumeTex(doc, {
      ...look,
      layout: toLayout({ bulletStyle: 'dash', headingStyle: 'bar', datesSide: 'right' }),
    });
    expect(tex).toContain('label={\\color{accent}\\textendash}');
    expect(tex).toContain('\\rule[-1pt]{3pt}{11pt}');
    expect(tex).toContain('\\hfill{\\small\\color{muted}Berlin | 01/2020 - today}');
    const below = resumeTex(doc, { ...look, layout: toLayout({ datesSide: 'below' }) });
    expect(below).toContain('{\\small\\color{muted}Berlin | 01/2020 - today}\\par');
    const none = resumeTex(doc, { ...look, layout: toLayout({ bulletStyle: 'none' }) });
    expect(none).toContain('leftmargin=0pt,label={\\color{accent}}');
    expect(resumeTex(doc, { ...look, layout: toLayout({ headingStyle: 'rule' }) })).toContain(
      '\\rule{\\linewidth}{0.6pt}',
    );
    expect(resumeTex(doc, { ...look, layout: toLayout({ headingStyle: 'bold' }) })).toContain(
      '\\large\\bfseries Experience',
    );
  });

  it('accepts only real hex colours', () => {
    expect(hexColor('#abcdef')).toBe('ABCDEF');
    expect(hexColor('red}\\evil')).toBe('1F4E79');
  });

  it('writes a DIN 5008 letter in German and a modern one in English', () => {
    const letter = {
      name: 'Mohamed Faizel',
      contact: ['Hauptstraße 1, 52062 Aachen', '+49 151 2345678'],
      city: 'Aachen',
      company: 'INFORM GmbH',
      companyCity: 'Aachen',
      jobTitle: 'Frontend Entwickler',
      paragraphs: letterParagraphs(
        'Sehr geehrte Damen und Herren,\n\nText.\n\nMit freundlichen Grüßen\nMohamed',
      ),
      date: new Date(2026, 9, 31),
    };
    const din = coverLetterTex(letter, { ...look, language: 'de' }, 'din');
    expect(din).toContain('\\begin{textblock}{85}(25,48)');
    expect(din).toContain('Aachen, 31.10.2026');
    expect(din).toContain('\\textbf{Bewerbung als Frontend Entwickler}');
    expect(din).toContain('Mit freundlichen Grüßen\\\\\nMohamed');
    expect(coverLetterTex({ ...letter, jobTitle: 'Entwickler (m/w/d)' }, look, 'din')).toContain(
      'Application for Entwickler}',
    );
    const modern = coverLetterTex(letter, look, 'modern');
    expect(modern).toContain('Application for Frontend Entwickler');
    expect(modern).toContain('Aachen, 31 October 2026');
  });

  it('formats letter dates per language', () => {
    expect(letterDate(new Date(2026, 0, 5), 'de')).toBe('05.01.2026');
    expect(letterDate(new Date(2026, 0, 5), 'en')).toBe('5 January 2026');
  });

  it('finds the city in an address', () => {
    expect(cityOf('Hauptstraße 1, 52062 Aachen')).toBe('Aachen');
    expect(cityOf('Berlin, Germany')).toBe('Berlin');
    expect(cityOf('')).toBeNull();
  });
});

describe('cleanPdf', () => {
  it('leaves only your name and a plain title in the PDF properties', async () => {
    const original = await PDFDocument.load(await textToPdf('# Ada\nHello', 'x'));
    original.setCreator('LaTeX with hyperref');
    original.setProducer('xdvipdfmx (20240305)');
    original.setKeywords(['hidden', 'keywords']);
    const cleaned = await PDFDocument.load(
      await cleanPdf(await original.save(), {
        title: 'Ada Lovelace – Resume',
        author: 'Ada Lovelace',
        language: 'en',
      }),
      { updateMetadata: false },
    );
    expect(cleaned.getTitle()).toBe('Ada Lovelace – Resume');
    expect(cleaned.getAuthor()).toBe('Ada Lovelace');
    expect(cleaned.getCreator()).toBeUndefined();
    expect(cleaned.getProducer()).toBeUndefined();
    expect(cleaned.getKeywords()).toBeUndefined();
  });
});
