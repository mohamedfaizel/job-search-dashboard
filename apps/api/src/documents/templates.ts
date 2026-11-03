import { contactItem, esc, inline } from './latex';
import type { MyDesign } from './my-design';
import { DEFAULT_DESIGN } from './my-design';
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
  // The six below follow the career-ops CV templates (MIT, github.com/career-ops-hq/career-ops),
  // rebuilt in LaTeX: same looks, one column, real text.
  {
    id: 'sharp',
    name: 'Sharp',
    description:
      'Bold name, accent rule under the header, company names in your colour. Most jobs.',
  },
  {
    id: 'bold',
    name: 'Bold',
    description:
      'Big name, accent bars before the headings, tinted summary. Tech and product roles.',
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'Serif, centred header, ruled capital headings, no colour. Banks and big firms.',
  },
  {
    id: 'leadership',
    name: 'Leadership',
    description: 'Skills and strengths before your work history. Leads and managers.',
  },
  {
    id: 'jake',
    name: 'Jake',
    description: 'The well-known engineering resume look: dates on the right, full-width rules.',
  },
  {
    id: 'ats',
    name: 'ATS plain',
    description: 'Black and white, no photo, no decoration: the safest for job portals.',
  },
] as const;
export type ResumeTemplateId = (typeof RESUME_TEMPLATES)[number]['id'];
export const isResumeTemplate = (id: string): id is ResumeTemplateId =>
  RESUME_TEMPLATES.some((t) => t.id === id);

/** Your own Word resume as the template (see docx-template.ts). */
export const MY_WORD_FILE = {
  id: 'mine',
  name: 'My own Word file',
  description:
    'The .docx you uploaded on this page: your layout, fonts and colours, with the tailored words.',
} as const;
/** The look of your own resume, rebuilt in LaTeX (see my-design.ts). */
export const MY_DESIGN = {
  id: 'design',
  name: 'My design',
  description:
    'The look of the resume you showed Claude: your colour, type, headings and order, in one clean column.',
} as const;
/** A built-in template, My design or your own Word file. */
export type ResumeChoice = ResumeTemplateId | typeof MY_DESIGN.id | typeof MY_WORD_FILE.id;
export const isResumeChoice = (id: string): id is ResumeChoice =>
  id === MY_WORD_FILE.id || id === MY_DESIGN.id || isResumeTemplate(id);

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
  /** A built-in template, or "design" for My design (then `design` holds it). */
  template: ResumeTemplateId | typeof MY_DESIGN.id;
  design?: MyDesign | null;
  /** Six hex digits, e.g. "1F4E79". */
  accent: string;
  font: FontChoice;
  /** File name of the photo next to the .tex file, or null for none. */
  photo: string | null;
  /** The document's language (ISO 639-1), for the date format and PDF language. */
  language: string;
}

const FONT_NAMES = {
  sans: 'TeX Gyre Heros',
  serif: 'TeX Gyre Pagella',
  // Computer Modern's look, as an OpenType font: what the Jake resume is known for.
  latin: 'Latin Modern Roman',
} as const;

/** How one template sets its type, spacing and parts. */
interface TemplateStyle {
  size: number;
  margin: string;
  top: string;
  entryGap: string;
  /** Its own type when the font setting is "auto". */
  font: keyof typeof FONT_NAMES;
  /** The name, headline and contact line centred. */
  centred: boolean;
  /** False for templates with no colour: the accent becomes near-black. */
  colour: boolean;
  /** False when the template never shows a photo (ATS plain). */
  photo: boolean;
  name: (name: string) => string;
  headline: (headline: string) => string;
  section: (title: string) => string;
  /** The title, company and "City | dates" line of a job or degree. */
  entry: (title: string, org: string | null, meta: string | null) => string;
  /** Text under the header that is not in a section, e.g. a summary without a heading. */
  summaryBox?: boolean;
  /** Moves the Skills section before Experience. */
  skillsFirst?: boolean;
}

const caps = (t: string) => `\\MakeUppercase{${t}}`;
const sep = (org: string | null) => (org ? ` {\\color{muted}\\textbar} ${org}` : '');
const metaLine = (meta: string | null) => (meta ? `{\\small\\color{muted}${meta}}\\par\n` : '');
const metaRight = (meta: string | null) => (meta ? `\\hfill{\\small\\color{muted}${meta}}` : '');

const STYLES: Record<ResumeTemplateId, TemplateStyle> = {
  classic: {
    size: 11,
    margin: '2cm',
    top: '1.6cm',
    entryGap: '7pt',
    font: 'serif',
    centred: true,
    colour: true,
    photo: true,
    name: (n) => `{\\fontsize{24}{24}\\selectfont\\scshape ${n}}`,
    headline: (h) => `{\\large\\color{muted}${h}}`,
    section: (t) =>
      `\\vspace{9pt}{\\large\\color{accent}\\scshape ${t}}\\par\\vspace{1pt}{\\color{accent}\\rule{\\linewidth}{0.6pt}}\\par\\vspace{4pt}\n`,
    entry: (t, o, m) => `\\textbf{${t}}${sep(o)}\\par\n${metaLine(m)}`,
  },
  modern: {
    size: 11,
    margin: '1.9cm',
    top: '1.5cm',
    entryGap: '7pt',
    font: 'sans',
    centred: false,
    colour: true,
    photo: true,
    name: (n) => `{\\fontsize{24}{24}\\selectfont\\bfseries\\color{accent}${n}}`,
    headline: (h) => `{\\large\\color{muted}${h}}`,
    section: (t) =>
      `\\vspace{10pt}{\\color{accent}\\bfseries\\large ${t}}\\par\\vspace{2pt}{\\color{accent}\\rule{\\linewidth}{1pt}}\\par\\vspace{5pt}\n`,
    entry: (t, o, m) => `\\textbf{${t}}${sep(o)}\\par\n${metaLine(m)}`,
  },
  compact: {
    size: 10,
    margin: '1.5cm',
    top: '1.2cm',
    entryGap: '4pt',
    font: 'sans',
    centred: false,
    colour: true,
    photo: true,
    name: (n) => `{\\fontsize{20}{20}\\selectfont\\bfseries\\color{accent}${n}}`,
    headline: (h) => `{\\large\\color{muted}${h}}`,
    section: (t) =>
      `\\vspace{6pt}{\\color{accent}\\bfseries ${t}}\\par\\vspace{1pt}{\\color{muted!40}\\rule{\\linewidth}{0.4pt}}\\par\\vspace{3pt}\n`,
    entry: (t, o, m) => `\\textbf{${t}}${sep(o)}${metaRight(m)}\\par\n`,
  },
  sharp: {
    size: 10.5,
    margin: '1.6cm',
    top: '1.4cm',
    entryGap: '6pt',
    font: 'sans',
    centred: false,
    colour: true,
    photo: true,
    name: (n) => `{\\fontsize{26}{28}\\selectfont\\bfseries ${n}}`,
    headline: (h) =>
      `{\\large\\color{accent}${h}}\\\\[3pt]{\\color{accent}\\rule{0.22\\linewidth}{2pt}}`,
    section: (t) =>
      `\\vspace{9pt}{\\small\\bfseries\\color{accent}${caps(t)}}\\par\\vspace{1pt}{\\color{muted!30}\\rule{\\linewidth}{0.4pt}}\\par\\vspace{4pt}\n`,
    entry: (t, o, m) =>
      `${o ? `{\\bfseries\\color{accent}${o}}` : `\\textbf{${t}}`}${metaRight(m)}\\par\n${o ? `\\textbf{${t}}\\par\n` : ''}`,
  },
  bold: {
    size: 10.5,
    margin: '1.7cm',
    top: '1.4cm',
    entryGap: '7pt',
    font: 'sans',
    centred: false,
    colour: true,
    photo: true,
    name: (n) => `{\\fontsize{32}{34}\\selectfont\\bfseries ${n}}`,
    headline: (h) => `{\\Large\\bfseries\\color{accent}${h}}`,
    section: (t) =>
      `\\vspace{10pt}{\\color{accent}\\rule[-1pt]{3pt}{11pt}}\\hspace{6pt}{\\bfseries ${caps(t)}}\\par\\vspace{5pt}\n`,
    entry: (t, o, m) =>
      `{\\large\\bfseries ${o ?? t}}${metaRight(m)}\\par\n${o ? `{\\bfseries\\color{accent}${t}}\\par\n` : ''}`,
    summaryBox: true,
  },
  executive: {
    size: 11,
    margin: '2cm',
    top: '1.6cm',
    entryGap: '7pt',
    font: 'serif',
    centred: true,
    colour: false,
    photo: true,
    name: (n) => `{\\fontsize{24}{26}\\selectfont\\bfseries ${caps(n)}}`,
    headline: (h) => `{\\large\\color{muted}${caps(h)}}`,
    section: (t) =>
      `\\vspace{10pt}{\\bfseries ${caps(t)}}\\par\\vspace{1pt}\\rule{\\linewidth}{0.5pt}\\par\\vspace{5pt}\n`,
    entry: (t, o, m) =>
      `\\textbf{${o ?? t}}${metaRight(m)}\\par\n${o ? `\\textit{${t}}\\par\n` : ''}`,
  },
  leadership: {
    size: 10.5,
    margin: '1.8cm',
    top: '1.5cm',
    entryGap: '7pt',
    font: 'sans',
    centred: false,
    colour: true,
    photo: true,
    name: (n) => `{\\fontsize{26}{28}\\selectfont\\bfseries\\color{accent}${n}}`,
    headline: (h) => `{\\large\\bfseries ${h}}`,
    section: (t) =>
      `\\vspace{10pt}{\\color{accent}\\bfseries\\large ${t}}\\par\\vspace{1pt}{\\color{accent}\\rule{\\linewidth}{0.8pt}}\\par\\vspace{4pt}\n`,
    entry: (t, o, m) => `\\textbf{${t}}${sep(o)}${metaRight(m)}\\par\n`,
    skillsFirst: true,
  },
  jake: {
    size: 11,
    margin: '1.5cm',
    top: '1.3cm',
    entryGap: '5pt',
    font: 'latin',
    centred: true,
    colour: false,
    photo: false,
    name: (n) => `{\\fontsize{26}{28}\\selectfont ${n}}`,
    headline: (h) => `{\\bfseries ${h}}`,
    section: (t) =>
      `\\vspace{8pt}{\\large ${caps(t)}}\\par\\vspace{-2pt}\\rule{\\linewidth}{0.5pt}\\par\\vspace{3pt}\n`,
    entry: (t, o, m) => {
      // "City | 01/2021 - today": the dates go on the right of the first line, the city on the
      // right of the second.
      const parts = (m ?? '').split(' | ');
      const dates = parts.length > 1 ? parts.slice(1).join(' | ') : (m ?? '');
      const place = parts.length > 1 ? (parts[0] ?? '') : '';
      const second =
        o || place ? `\\textit{${o ? t : ''}}\\hfill{\\small\\textit{${place}}}\\par\n` : '';
      return `\\textbf{${o ?? t}}${dates ? `\\hfill ${dates}` : ''}\\par\n${second}`;
    },
  },
  ats: {
    size: 11,
    margin: '2cm',
    top: '1.6cm',
    entryGap: '7pt',
    font: 'sans',
    centred: false,
    colour: false,
    photo: false,
    name: (n) => `{\\fontsize{20}{22}\\selectfont\\bfseries ${n}}`,
    headline: (h) => h,
    section: (t) => `\\vspace{10pt}{\\large\\bfseries ${caps(t)}}\\par\\vspace{4pt}\n`,
    entry: (t, o, m) => `\\textbf{${t}}${o ? `, ${o}` : ''}\\par\n${m ? `${m}\\par\n` : ''}`,
  },
};

/** My design as a template: the same parts as the built-in ones, set from your settings. */
export function designStyle(d: MyDesign): TemplateStyle {
  const compact = d.density === 'compact';
  const nameSize = { normal: 20, large: 26, huge: 32 }[d.nameSize] - (compact ? 2 : 0);
  const nameShape = {
    bold: (n: string) => `\\bfseries ${n}`,
    caps: (n: string) => `\\bfseries ${caps(n)}`,
    smallcaps: (n: string) => `\\scshape ${n}`,
    plain: (n: string) => n,
  }[d.nameStyle];
  const nameColour = d.nameColour === 'accent' ? '\\color{accent}' : '';
  const headColour = d.headingColour === 'accent' ? '\\color{accent}' : '';
  const word = (t: string) => (d.headingCase === 'upper' ? caps(t) : t);
  const gap = compact ? '6pt' : '9pt';
  const section = {
    rule: (t: string) =>
      `\\vspace{${gap}}{${headColour}\\bfseries ${word(t)}}\\par\\vspace{1pt}{${headColour}\\rule{\\linewidth}{0.6pt}}\\par\\vspace{4pt}\n`,
    bar: (t: string) =>
      `\\vspace{${gap}}{\\color{accent}\\rule[-1pt]{3pt}{11pt}}\\hspace{6pt}{${headColour}\\bfseries ${word(t)}}\\par\\vspace{4pt}\n`,
    plain: (t: string) =>
      `\\vspace{${gap}}{${headColour}\\bfseries\\large ${word(t)}}\\par\\vspace{3pt}\n`,
  }[d.headingStyle];
  return {
    size: compact ? 10 : 11,
    margin: compact ? '1.5cm' : '1.9cm',
    top: compact ? '1.2cm' : '1.5cm',
    entryGap: compact ? '4pt' : '7pt',
    font: d.font,
    centred: d.align === 'centre',
    colour: true,
    photo: d.photo,
    name: (n) =>
      `{\\fontsize{${String(nameSize)}}{${String(nameSize + 2)}}\\selectfont${nameColour}${nameShape(n)}}`,
    headline: (h) => `{\\large\\color{muted}${h}}`,
    section,
    entry: (t, o, m) => {
      const first = d.companyFirst && o ? o : t;
      const second = d.companyFirst && o ? t : o;
      const line1 = d.companyFirst && o ? `\\textbf{${first}}` : `\\textbf{${first}}${sep(second)}`;
      const line2 = d.companyFirst && o ? `\\textit{${t}}\\par\n` : '';
      return d.dates === 'right'
        ? `${line1}${metaRight(m)}\\par\n${line2}`
        : `${line1}\\par\n${line2}${metaLine(m)}`;
    },
    skillsFirst: d.skillsFirst,
  };
}

function styleOf(look: DocumentLook): TemplateStyle {
  if (look.template === MY_DESIGN.id) return designStyle(look.design ?? DEFAULT_DESIGN);
  return STYLES[look.template];
}

const fontFor = (look: DocumentLook) =>
  FONT_NAMES[look.font === 'auto' ? styleOf(look).font : look.font];

/** "#1f4e79" or "1F4E79" → "1F4E79"; anything else → the default blue. */
export function hexColor(value: string): string {
  const hex = value.replace(/^#/, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(hex) ? hex : '1F4E79';
}

function preamble(look: DocumentLook, size: number, geometry: string, extra = ''): string {
  // No common ligatures ("fi", "fl"): some applicant tracking systems read them as one odd
  // character. Title and author go into the PDF properties; the API sets them again after.
  const style = styleOf(look);
  const accent = style.colour ? hexColor(look.accent) : '222222';
  return `\\documentclass[${String(size)}pt,a4paper]{article}
\\usepackage[a4paper,${geometry}]{geometry}
\\usepackage{fontspec}
\\setmainfont{${fontFor(look)}}[Ligatures={TeX,NoCommon}]
\\usepackage{xcolor}
\\definecolor{accent}{HTML}{${accent}}
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

function block(look: DocumentLook, b: ResumeBlock, summary = false): string {
  const style = styleOf(look);
  switch (b.kind) {
    case 'paragraph':
      return summary && style.summaryBox
        ? `\\colorbox{accent!8}{\\parbox{\\dimexpr\\linewidth-2\\fboxsep}{${inline(b.text)}}}\\par\\vspace{4pt}\n`
        : `${inline(b.text)}\\par\\vspace{3pt}\n`;
    case 'bullets':
      return itemize(b.items);
    case 'entry': {
      const head = style.entry(
        inline(b.title),
        b.org ? inline(b.org) : null,
        b.meta ? inline(b.meta) : null,
      );
      const lines = b.lines.map((l) => `${inline(l)}\\par\n`).join('');
      return `${head}${lines}${itemize(b.bullets)}\\vspace{${style.entryGap}}\n`;
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
  const style = styleOf(look);
  const name = style.name(esc(doc.name));
  const headline = doc.headline ? `\\\\[5pt]${style.headline(inline(doc.headline))}` : '';
  const contact = doc.contact.length
    ? `\\\\[5pt]{\\small ${doc.contact.map(contactItem).join(' {\\color{muted}\\enspace|\\enspace} ')}}`
    : '';
  const text = `${name}${headline}${contact}`;
  if (look.photo && style.photo) {
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

/** Section titles that mean Skills or Experience, in the languages the app supports. */
const SKILLS_TITLE =
  /^(skills|core skills|key skills|technical skills|core competencies|competencies|kenntnisse|fähigkeiten|kompetenzen|fachkenntnisse|skills (&|und) kompetenzen)$/i;
const EXPERIENCE_TITLE =
  /^(experience|work experience|professional experience|berufserfahrung|erfahrung|beruflicher werdegang)$/i;

/** For Leadership: your skills and strengths come before the work history. */
function skillsBeforeExperience(sections: ResumeDoc['sections']): ResumeDoc['sections'] {
  const skills = sections.findIndex((s) => SKILLS_TITLE.test(s.title.trim()));
  const experience = sections.findIndex((s) => EXPERIENCE_TITLE.test(s.title.trim()));
  if (skills < 0 || experience < 0 || skills < experience) return sections;
  const out = sections.filter((_, i) => i !== skills);
  out.splice(experience, 0, sections[skills] as ResumeDoc['sections'][number]);
  return out;
}

/** A resume as a complete .tex file in the chosen template. */
export function resumeTex(doc: ResumeDoc, look: DocumentLook): string {
  const s = styleOf(look);
  const sections = s.skillsFirst ? skillsBeforeExperience(doc.sections) : doc.sections;
  const body = sections
    .map((section, i) => {
      const first =
        i === 0 ||
        /^(summary|profile|professional summary|profil|kurzprofil|zusammenfassung)$/i.test(
          section.title.trim(),
        );
      return (
        (section.title ? s.section(inline(section.title)) : '') +
        section.blocks.map((b) => block(look, b, first)).join('')
      );
    })
    .join('');
  return `${preamble(look, s.size, `left=${s.margin},right=${s.margin},top=${s.top},bottom=${s.top}`)}
\\begin{document}
\\raggedright
${header(look, doc, s.centred)}${body}
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
