import { contactItem, esc, inline } from './latex';
import type { ResumeBlock, ResumeDoc } from './resume-doc';

/**
 * The built-in resume templates. All are one column with real text, so applicant tracking
 * systems read them the same way as a plain resume; they differ in type, colour and spacing.
 */
export const RESUME_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Centred name, serif type, small-caps headings with a rule. Calm and formal.',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Name and headings in your accent colour, clean sans-serif type.',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Smaller type and tighter spacing: fits a long career on fewer pages.',
  },
] as const;
export type ResumeTemplateId = (typeof RESUME_TEMPLATES)[number]['id'];
export const isResumeTemplate = (id: string): id is ResumeTemplateId =>
  RESUME_TEMPLATES.some((t) => t.id === id);

/** How a cover letter is laid out: DIN 5008 is the German business letter standard. */
export const LETTER_LAYOUTS = [
  { id: 'auto', name: 'Automatic', description: 'DIN 5008 for German letters, Modern otherwise.' },
  {
    id: 'din',
    name: 'DIN 5008',
    description: 'German standard: address field, date on the right, bold subject line.',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Your resume header, then date, company and subject.',
  },
] as const;
export type LetterLayoutId = (typeof LETTER_LAYOUTS)[number]['id'];
export const isLetterLayout = (id: string): id is LetterLayoutId =>
  LETTER_LAYOUTS.some((l) => l.id === id);

export const FONTS = ['auto', 'sans', 'serif'] as const;
export type FontChoice = (typeof FONTS)[number];

export interface DocumentLook {
  template: ResumeTemplateId;
  /** Six hex digits, e.g. "1F4E79". */
  accent: string;
  font: FontChoice;
  /** File name of the photo next to the .tex file, or null for none. */
  photo: string | null;
  /** The document's language (ISO 639-1), for the date format and PDF language. */
  language: string;
}

const FONT_NAMES = { sans: 'TeX Gyre Heros', serif: 'TeX Gyre Pagella' } as const;
const fontFor = (look: DocumentLook) =>
  FONT_NAMES[look.font === 'auto' ? (look.template === 'classic' ? 'serif' : 'sans') : look.font];

/** "#1f4e79" or "1F4E79" → "1F4E79"; anything else → the default blue. */
export function hexColor(value: string): string {
  const hex = value.replace(/^#/, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(hex) ? hex : '1F4E79';
}

const SPACING = {
  classic: { size: 11, margin: '2cm', top: '1.6cm', entryGap: '7pt' },
  modern: { size: 11, margin: '1.9cm', top: '1.5cm', entryGap: '7pt' },
  compact: { size: 10, margin: '1.5cm', top: '1.2cm', entryGap: '4pt' },
} as const;

function preamble(look: DocumentLook, size: number, geometry: string, extra = ''): string {
  // No common ligatures ("fi", "fl"): some applicant tracking systems read them as one odd
  // character. Title and author go into the PDF properties; the API sets them again after.
  return `\\documentclass[${String(size)}pt,a4paper]{article}
\\usepackage[a4paper,${geometry}]{geometry}
\\usepackage{fontspec}
\\setmainfont{${fontFor(look)}}[Ligatures={TeX,NoCommon}]
\\usepackage{xcolor}
\\definecolor{accent}{HTML}{${hexColor(look.accent)}}
\\definecolor{muted}{HTML}{555B66}
\\usepackage{enumitem}
\\setlist[itemize]{leftmargin=1.1em,label={\\color{accent}\\textbullet},itemsep=1pt,parsep=0pt,topsep=2pt}
\\usepackage{graphicx}
\\usepackage{tabularx}
\\usepackage[hidelinks]{hyperref}
${extra}\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
`;
}

/** The section title in each template's style. */
function sectionTitle(look: DocumentLook, title: string): string {
  const t = inline(title);
  switch (look.template) {
    case 'classic':
      return `\\vspace{9pt}{\\large\\color{accent}\\scshape ${t}}\\par\\vspace{1pt}{\\color{accent}\\rule{\\linewidth}{0.6pt}}\\par\\vspace{4pt}\n`;
    case 'modern':
      return `\\vspace{10pt}{\\color{accent}\\bfseries\\large ${t}}\\par\\vspace{2pt}{\\color{accent}\\rule{\\linewidth}{1pt}}\\par\\vspace{5pt}\n`;
    case 'compact':
      return `\\vspace{6pt}{\\color{accent}\\bfseries ${t}}\\par\\vspace{1pt}{\\color{muted!40}\\rule{\\linewidth}{0.4pt}}\\par\\vspace{3pt}\n`;
  }
}

function block(look: DocumentLook, b: ResumeBlock): string {
  switch (b.kind) {
    case 'paragraph':
      return `${inline(b.text)}\\par\\vspace{3pt}\n`;
    case 'bullets':
      return itemize(b.items);
    case 'entry': {
      const org = b.org ? ` {\\color{muted}\\textbar} ${inline(b.org)}` : '';
      const meta = b.meta ? inline(b.meta) : '';
      const head =
        look.template === 'compact'
          ? `\\textbf{${inline(b.title)}}${org}${meta ? `\\hfill{\\small\\color{muted}${meta}}` : ''}\\par\n`
          : `\\textbf{${inline(b.title)}}${org}\\par\n${meta ? `{\\small\\color{muted}${meta}}\\par\n` : ''}`;
      const lines = b.lines.map((l) => `${inline(l)}\\par\n`).join('');
      return `${head}${lines}${itemize(b.bullets)}\\vspace{${SPACING[look.template].entryGap}}\n`;
    }
  }
}

function itemize(items: string[]): string {
  if (!items.length) return '';
  return `\\begin{itemize}\n${items.map((i) => `\\item ${inline(i)}`).join('\n')}\n\\end{itemize}\n`;
}

/** Name, headline and contact line, with the photo on the right when there is one. */
function header(
  look: DocumentLook,
  doc: Pick<ResumeDoc, 'name' | 'headline' | 'contact'>,
  centred: boolean,
): string {
  const size = look.template === 'compact' ? '20' : '24';
  const name =
    look.template === 'classic'
      ? `{\\fontsize{${size}}{${size}}\\selectfont\\scshape ${esc(doc.name)}}`
      : `{\\fontsize{${size}}{${size}}\\selectfont\\bfseries\\color{accent}${esc(doc.name)}}`;
  const headline = doc.headline ? `\\\\[5pt]{\\large\\color{muted}${inline(doc.headline)}}` : '';
  const contact = doc.contact.length
    ? `\\\\[5pt]{\\small ${doc.contact.map(contactItem).join(' {\\color{muted}\\enspace|\\enspace} ')}}`
    : '';
  const text = `${name}${headline}${contact}`;
  if (look.photo) {
    const align = centred ? '\\centering' : '\\raggedright';
    return `\\begin{tabularx}{\\linewidth}{@{}>{${align}\\arraybackslash}X@{\\hspace{12pt}}r@{}}
\\begin{minipage}[c]{\\linewidth}${align}${text}\\end{minipage} &
\\raisebox{-0.5\\height}{\\includegraphics[width=2.8cm,height=3.6cm,keepaspectratio]{${look.photo}}}
\\end{tabularx}\\par\\vspace{6pt}\n`;
  }
  return centred
    ? `\\begin{center}${text}\\end{center}\\vspace{2pt}\n`
    : `{\\raggedright ${text}\\par}\\vspace{8pt}\n`;
}

/** A resume as a complete .tex file in the chosen template. */
export function resumeTex(doc: ResumeDoc, look: DocumentLook): string {
  const s = SPACING[look.template];
  const body = doc.sections
    .map(
      (section) =>
        (section.title ? sectionTitle(look, section.title) : '') +
        section.blocks.map((b) => block(look, b)).join(''),
    )
    .join('');
  return `${preamble(look, s.size, `left=${s.margin},right=${s.margin},top=${s.top},bottom=${s.top}`)}
\\begin{document}
\\raggedright
${header(look, doc, look.template === 'classic')}${body}
\\end{document}
`;
}

export interface Letter {
  name: string;
  /** Your address, phone, email, links. */
  contact: string[];
  /** Where you live, for the date line ("Berlin, 31.10.2026"). */
  city: string | null;
  company: string;
  companyCity: string | null;
  jobTitle: string;
  /** Claude's letter, greeting to signature, one string per paragraph. */
  paragraphs: string[];
  date: Date;
}

/** "31.10.2026" in German, "31 October 2026" otherwise. */
export function letterDate(date: Date, language: string): string {
  if (language === 'de') {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())}`;
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const paragraphsTex = (paragraphs: string[]) =>
  paragraphs.map((p) => p.split('\n').map(inline).join('\\\\\n')).join('\\par\\vspace{9pt}\n');

/**
 * A cover letter in the same look as the resume. DIN 5008 (Form B) puts your return address
 * and the company in the window-envelope field at 45 mm, the date on the right and the subject
 * in bold; Modern starts with your resume header.
 */
export function coverLetterTex(letter: Letter, look: DocumentLook, layout: 'din' | 'modern') {
  const german = look.language === 'de';
  // "(m/w/d)" and "(all genders)" belong in the ad, not in your subject line.
  const title = letter.jobTitle
    .replace(/\s*\((?:(?:[mwfd]\s*\/\s*){2}[mwfd]\*?|all genders|gn\*?)\)/gi, '')
    .trim();
  const subject = german ? `Bewerbung als ${title}` : `Application for ${title}`;
  const date = letterDate(letter.date, look.language);
  const dateLine = letter.city ? `${esc(letter.city)}, ${esc(date)}` : esc(date);
  const recipient = [letter.company, letter.companyCity]
    .filter((l): l is string => !!l)
    .map(esc)
    .join('\\\\\n');
  const body = paragraphsTex(letter.paragraphs);

  if (layout === 'din') {
    const returnLine = [letter.name, ...letter.contact.slice(0, 1)].map(esc).join(' · ');
    return `${preamble(look, 11, 'left=25mm,right=20mm,top=97mm,bottom=20mm', '\\usepackage[absolute]{textpos}\n\\setlength{\\TPHorizModule}{1mm}\\setlength{\\TPVertModule}{1mm}\n')}
\\begin{document}
\\raggedright
\\begin{textblock}{165}(25,15)
${header({ ...look, photo: null }, { name: letter.name, headline: null, contact: letter.contact }, false)}\\end{textblock}
\\begin{textblock}{85}(25,48)
{\\scriptsize\\underline{${returnLine}}}\\\\[6pt]
${recipient}
\\end{textblock}
{\\raggedleft ${dateLine}\\par}
\\vspace{14pt}
\\textbf{${esc(subject)}}\\par
\\vspace{14pt}
${body}
\\end{document}
`;
  }

  return `${preamble(look, 11, 'left=2.2cm,right=2.2cm,top=1.6cm,bottom=2cm')}
\\begin{document}
\\raggedright
${header({ ...look, photo: null }, { name: letter.name, headline: null, contact: letter.contact }, false)}
\\vspace{14pt}
${recipient}\\par
\\vspace{10pt}
{\\raggedleft ${dateLine}\\par}
\\vspace{12pt}
{\\color{accent}\\bfseries ${esc(subject)}}\\par
\\vspace{12pt}
${body}
\\end{document}
`;
}
