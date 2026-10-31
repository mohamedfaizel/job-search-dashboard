import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { textToPdf } from '../insights/pdf';
import { cityOf } from './documents.service';
import { contactItem, esc, inline } from './latex';
import { cleanPdf } from './pdf-metadata';
import { letterParagraphs, parseResume } from './resume-doc';
import { coverLetterTex, hexColor, letterDate, resumeTex } from './templates';

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
      meta: 'Aachen | 01/2021 – heute',
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
    for (const template of ['classic', 'modern', 'compact'] as const) {
      const tex = resumeTex(doc, { ...look, template });
      // No white or tiny text: nothing a reader can't see.
      expect(tex).not.toMatch(/\\color\{white\}|\\tiny|\\phantom/);
      expect(tex.toLowerCase()).not.toContain('latex');
    }
    expect(resumeTex(doc, { ...look, photo: 'photo.jpg' })).toContain(
      '\\includegraphics[width=2.8cm,height=3.6cm,keepaspectratio]{photo.jpg}',
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
