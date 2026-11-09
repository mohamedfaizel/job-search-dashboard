import { randomUUID } from 'node:crypto';
import { parseResume } from '../documents/resume-doc';
import type { ResumeDoc } from '../documents/resume-doc';

/**
 * Your resume as the Resume builder edits it: a header and sections you can move, rename and
 * hide. Each section holds blocks of three kinds, the same ones the PDF templates lay out:
 *
 *   paragraph  "Frontend engineer with 8 years in React…"
 *   bullets    "- React, TypeScript"
 *   entry      a job, degree or project: title, organisation, place and dates, bullets
 *
 * It is saved as JSON. Everything else in the app (Fit %, prompts, PDFs) reads the Markdown
 * that `toMarkdown` writes from it, the layout the Apply kit already uses.
 */
/** A project inside a job or company: its name, the tech it used, and what you did. */
export interface BuilderProject {
  id: string;
  name: string;
  /** "React, MQTT" */
  tech: string;
  bullets: string[];
}

export interface BuilderEntry {
  id: string;
  kind: 'entry';
  /** "Senior Frontend Engineer" */
  title: string;
  /** "Acme GmbH" */
  org: string;
  /** "Berlin | 01/2021 - today" */
  meta: string;
  bullets: string[];
  /** Plain lines under the entry that are not bullets. */
  lines: string[];
  /** Projects of this job. Missing in resumes saved before projects existed. */
  projects?: BuilderProject[];
}

export interface BuilderParagraph {
  id: string;
  kind: 'paragraph';
  text: string;
}

export interface BuilderBullets {
  id: string;
  kind: 'bullets';
  items: string[];
}

export type BuilderBlock = BuilderEntry | BuilderParagraph | BuilderBullets;

export interface BuilderSection {
  id: string;
  title: string;
  /** Hidden sections stay in the builder but are left out of the PDF and of every prompt. */
  hidden: boolean;
  blocks: BuilderBlock[];
}

export interface BuilderDoc {
  name: string;
  headline: string;
  /** Address, phone, email, links: one item each. CONTACT_BREAK starts a new line. */
  contact: string[];
  sections: BuilderSection[];
}

/** A contact "item" that is a line break in the PDF's header, not a detail. */
export const CONTACT_BREAK = '\n';

/** Big enough for any real resume, small enough to keep junk out. */
export const LIMITS = {
  sections: 40,
  blocks: 100,
  items: 60,
  contact: 12,
  text: 4000,
  json: 300_000,
} as const;

export const newId = () => randomUUID().slice(0, 8);

/** The contact items with a CONTACT_BREAK where each new line starts. */
function withBreaks(contact: string[], breaks: number[] = []): string[] {
  return contact.flatMap((item, i) =>
    i > 0 && breaks.includes(i) ? [CONTACT_BREAK, item] : [item],
  );
}

/** The doc read from the Markdown layout (an AI chat reply, or a saved job resume). */
export function fromResumeDoc(doc: ResumeDoc): BuilderDoc {
  return {
    name: doc.name,
    headline: doc.headline ?? '',
    contact: withBreaks(doc.contact, doc.contactBreaks),
    sections: doc.sections.map((section) => ({
      id: newId(),
      title: section.title,
      hidden: false,
      blocks: section.blocks.map((block): BuilderBlock => {
        if (block.kind === 'entry') {
          return {
            id: newId(),
            kind: 'entry',
            title: block.title,
            org: block.org ?? '',
            meta: block.meta ?? '',
            bullets: block.bullets,
            lines: block.lines,
            projects: block.projects.map((p) => ({
              id: newId(),
              name: p.name,
              tech: p.tech ?? '',
              bullets: p.bullets,
            })),
          };
        }
        if (block.kind === 'bullets') return { id: newId(), kind: 'bullets', items: block.items };
        return { id: newId(), kind: 'paragraph', text: block.text };
      }),
    })),
  };
}

/**
 * Section titles a resume uses, in the languages we support. A plain-text resume (read from a
 * PDF or Word file) has no Markdown, so these and lines in capitals tell where sections start.
 */
const KNOWN_HEADINGS = new Set(
  [
    // English
    'summary',
    'profile',
    'professional summary',
    'about me',
    'experience',
    'work experience',
    'professional experience',
    'employment history',
    'career history',
    'education',
    'skills',
    'technical skills',
    'core competencies',
    'key skills',
    'projects',
    'certifications',
    'certificates',
    'courses',
    'languages',
    'awards',
    'achievements',
    'key highlights',
    'publications',
    'volunteering',
    'volunteer experience',
    'interests',
    'hobbies',
    'references',
    // German
    'profil',
    'kurzprofil',
    'über mich',
    'berufserfahrung',
    'berufliche erfahrung',
    'beruflicher werdegang',
    'werdegang',
    'ausbildung',
    'bildung',
    'studium',
    'kenntnisse',
    'fähigkeiten',
    'fachkenntnisse',
    'it-kenntnisse',
    'kompetenzen',
    'projekte',
    'zertifikate',
    'zertifizierungen',
    'weiterbildung',
    'sprachen',
    'sprachkenntnisse',
    'auszeichnungen',
    'erfolge',
    'ehrenamt',
    'interessen',
    'hobbys',
    'referenzen',
  ].map((h) => h.toLowerCase()),
);

const PLAIN_BULLET = /^\s*[•●▪◦‣∙·*–-]\s*(.+)$/;
/** "Title | Organisation", "Title, Organisation" or "Title at Organisation", without dates. */
const ENTRY_LINE = /^[^\d]{2,80}(\s[|·•–-]\s|,\s|\sat\s|\sbei\s)[^\d]{2,80}$/;
const YEAR = /\b(19|20)\d{2}\b/;

/** True for a short line that names a section: a known title, or a line in capitals. */
function isHeadingLine(line: string): boolean {
  const text = line.trim().replace(/:$/, '');
  if (text.length < 3 || text.length > 40 || /[.,;]$/.test(text)) return false;
  if (KNOWN_HEADINGS.has(text.toLowerCase())) return true;
  const letters = text.replace(/[^\p{L}]/gu, '');
  return letters.length >= 4 && letters === letters.toUpperCase() && !/\d/.test(text);
}

/**
 * Turns plain resume text (from an uploaded file) into the Markdown layout, as well as rules
 * can: the first line is your name, the lines up to the first section are the header, section
 * titles become "##", bullet signs become "-". Jobs inside a section stay plain lines; the
 * AI chat prompt (`structurePrompt`) reads them into entries properly.
 */
export function plainToMarkdown(text: string): string {
  const out: string[] = [];
  let seenName = false;
  let inSection = false;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line) {
      out.push('');
      continue;
    }
    if (!seenName) {
      out.push(`# ${line}`);
      seenName = true;
      continue;
    }
    if (isHeadingLine(line)) {
      out.push('', `## ${line.replace(/:$/, '')}`);
      inSection = true;
      continue;
    }
    // "Senior Engineer | Acme GmbH" with a line of dates under it is a job, degree or project.
    const next =
      lines
        .slice(index + 1)
        .find((l) => l.trim())
        ?.trim() ?? '';
    if (inSection && ENTRY_LINE.test(line) && !PLAIN_BULLET.test(line) && YEAR.test(next)) {
      out.push('', `### ${line}`);
      continue;
    }
    const bullet = PLAIN_BULLET.exec(line);
    out.push(bullet ? `- ${bullet[1] ?? ''}` : line);
  }
  return out.join('\n');
}

/** Has Markdown headings, so it is in the layout already (a builder save or an AI reply). */
const isMarkdown = (text: string) => /^#{1,3}\s+\S/m.test(text);

/** Your resume text, as it is saved on My profile, read into sections. */
export function textToBuilderDoc(text: string, fallbackName: string): BuilderDoc {
  if (!text.trim()) return emptyDoc(fallbackName);
  const markdown = isMarkdown(text) ? text : plainToMarkdown(text);
  return fromResumeDoc(parseResume(markdown, fallbackName));
}

/** Section titles for a new resume, in its language. */
const STARTER_TITLES: Record<string, string[]> = {
  en: ['Summary', 'Experience', 'Education', 'Skills', 'Languages'],
  de: ['Profil', 'Berufserfahrung', 'Ausbildung', 'Kenntnisse', 'Sprachen'],
};

/** A resume with only the usual section titles, for someone who has none yet. */
export function emptyDoc(name: string, language = 'en'): BuilderDoc {
  const titles = STARTER_TITLES[language] ?? STARTER_TITLES['en'] ?? [];
  return {
    name,
    headline: '',
    contact: [],
    sections: titles.map((title) => ({ id: newId(), title, hidden: false, blocks: [] })),
  };
}

const LANGUAGE_TITLES =
  /^(languages?|language skills|sprachen|sprachkenntnisse|langues|idiomas|lingue|talen|języki|línguas)$/i;

/** True for the Languages section, which always lists the languages on My profile. */
export const isLanguagesSection = (title: string) => LANGUAGE_TITLES.test(title.trim());

/**
 * Puts the languages from My profile, with your real levels, into the Languages section. A
 * resume can never claim a better level than you have (German A2 stays A2), whatever was
 * typed or pasted. Without languages on My profile the section stays as written.
 */
export function lockLanguages(doc: BuilderDoc, languages: string[]): BuilderDoc {
  const items = languages.map((l) => l.trim()).filter(Boolean);
  if (!items.length) return doc;
  return {
    ...doc,
    sections: doc.sections.map((section) =>
      isLanguagesSection(section.title)
        ? { ...section, blocks: [{ id: section.blocks[0]?.id ?? newId(), kind: 'bullets', items }] }
        : section,
    ),
  };
}

/** One line: no line breaks, single spaces. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The resume in the Markdown layout every other part of the app reads. Hidden sections and
 * empty lines are left out.
 */
export function toMarkdown(doc: BuilderDoc): string {
  const out: string[] = [`# ${oneLine(doc.name) || 'Your Name'}`];
  if (oneLine(doc.headline)) out.push(oneLine(doc.headline));
  // One Markdown line per header line: the PDF keeps your line breaks.
  const lines: string[][] = [[]];
  for (const item of doc.contact) {
    if (item === CONTACT_BREAK) lines.push([]);
    else if (oneLine(item)) lines.at(-1)?.push(oneLine(item));
  }
  for (const line of lines) if (line.length) out.push(line.join(' | '));

  for (const section of doc.sections) {
    if (section.hidden) continue;
    const lines: string[] = [];
    for (const block of section.blocks) {
      if (block.kind === 'paragraph') {
        const text = oneLine(block.text);
        if (text) lines.push('', text);
      } else if (block.kind === 'bullets') {
        const items = block.items.map(oneLine).filter(Boolean);
        if (items.length) lines.push('', ...items.map((item) => `- ${item}`));
      } else {
        const title = oneLine(block.title);
        const org = oneLine(block.org);
        if (!title && !org) continue;
        lines.push('', `### ${[title || org, title ? org : ''].filter(Boolean).join(' | ')}`);
        const meta = oneLine(block.meta);
        if (meta) lines.push(meta);
        lines.push(
          ...block.bullets
            .map(oneLine)
            .filter(Boolean)
            .map((b) => `- ${b}`),
        );
        lines.push(...block.lines.map(oneLine).filter(Boolean));
        for (const project of block.projects ?? []) {
          const name = oneLine(project.name);
          const tech = oneLine(project.tech);
          const bullets = project.bullets.map(oneLine).filter(Boolean);
          if (!name && !tech && !bullets.length) continue;
          lines.push('', `#### ${[name || tech, name ? tech : ''].filter(Boolean).join(' | ')}`);
          lines.push(...bullets.map((b) => `- ${b}`));
        }
      }
    }
    const title = oneLine(section.title);
    // An empty section without a title adds nothing; one with a title but no content is
    // left out too, so the PDF never shows a lonely heading.
    if (!lines.length) continue;
    out.push('', `## ${title || '-'}`, ...lines);
  }
  return `${out.join('\n')}\n`;
}

/** Thrown when a saved doc is not in the shape above. */
export class BuilderDocError extends Error {}

const str = (value: unknown, max: number = LIMITS.text): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

const strings = (value: unknown, max: number = LIMITS.items): string[] =>
  Array.isArray(value) ? value.slice(0, max).map((v) => str(v)) : [];

const id = (value: unknown): string => {
  const text = str(value, 40);
  return /^[\w-]{1,40}$/.test(text) ? text : newId();
};

function readProjects(value: unknown): BuilderProject[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, LIMITS.items).map((raw) => {
    const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      id: id(p['id']),
      name: str(p['name'], 300),
      tech: str(p['tech'], 300),
      bullets: strings(p['bullets']),
    };
  });
}

function readBlock(value: unknown): BuilderBlock | null {
  if (!value || typeof value !== 'object') return null;
  const b = value as Record<string, unknown>;
  switch (b['kind']) {
    case 'paragraph':
      return { id: id(b['id']), kind: 'paragraph', text: str(b['text']) };
    case 'bullets':
      return { id: id(b['id']), kind: 'bullets', items: strings(b['items']) };
    case 'entry':
      return {
        id: id(b['id']),
        kind: 'entry',
        title: str(b['title'], 300),
        org: str(b['org'], 300),
        meta: str(b['meta'], 300),
        bullets: strings(b['bullets']),
        lines: strings(b['lines']),
        projects: readProjects(b['projects']),
      };
    default:
      return null;
  }
}

/**
 * Reads a doc sent by the browser. Unknown fields are dropped and long text is cut; anything
 * that is not a resume at all is an error.
 */
export function readBuilderDoc(json: string): BuilderDoc {
  if (json.length > LIMITS.json) throw new BuilderDocError('The resume is too long');
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new BuilderDocError('The resume is not valid JSON');
  }
  if (!value || typeof value !== 'object' || !Array.isArray((value as BuilderDoc).sections)) {
    throw new BuilderDocError('The resume has no sections');
  }
  const doc = value as Record<string, unknown>;
  const sections = (doc['sections'] as unknown[]).slice(0, LIMITS.sections).map((raw) => {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      id: id(s['id']),
      title: str(s['title'], 120),
      hidden: s['hidden'] === true,
      blocks: (Array.isArray(s['blocks']) ? s['blocks'] : [])
        .slice(0, LIMITS.blocks)
        .map(readBlock)
        .filter((b): b is BuilderBlock => b !== null),
    };
  });
  return {
    name: str(doc['name'], 200),
    headline: str(doc['headline'], 300),
    contact: strings(doc['contact'], LIMITS.contact),
    sections,
  };
}

/**
 * Asks an AI chat to put your resume into the builder's layout without changing a word. The
 * rules can't tell a job title from a bullet in plain text; an AI can.
 */
export function structurePrompt(text: string, language: string): string {
  const example =
    language === 'de'
      ? `# Vorname Nachname
Senior Frontend Engineer
Berlin, Deutschland | +49 … | ich@example.com | linkedin.com/in/ich

## Berufserfahrung
### Senior Frontend Engineer | Acme GmbH
Berlin | 01/2021 - heute
- Was ich gemacht habe

## Kenntnisse
- **Frontend:** React, TypeScript`
      : `# First Last
Senior Frontend Engineer
Berlin, Germany | +49 … | me@example.com | linkedin.com/in/me

## Experience
### Senior Frontend Engineer | Acme GmbH
Berlin | 01/2021 - today
- What I did

## Skills
- **Frontend:** React, TypeScript`;
  return `Please put my resume into the Markdown layout below so a resume editor can read it.

Rules:
- Do not change, add, shorten or improve any word, number, date or link. Only move lines into the layout.
- Keep every section with my own section titles and in my order.
- "# " is my name, the next line my headline, then one line of contact details separated by " | ".
- "## " starts a section. In sections with jobs, degrees or projects, each one is "### Title | Organisation", then a line with place and dates (plain hyphen: 01/2021 - 03/2024), then its bullets.
- Bullets start with "- ". Text that is not a bullet stays a plain line.
- Reply with only the resume in this layout, no notes before or after it.

Layout:
"""
${example}
"""

My resume:
"""
${text.trim()}
"""`;
}
