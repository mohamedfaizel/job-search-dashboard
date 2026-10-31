/**
 * A resume read from the Markdown layout the Apply kit prompt asks Claude for:
 *
 *   # Full Name
 *   Headline
 *   City, Country | +49 … | me@example.com | linkedin.com/in/me
 *
 *   ## Experience
 *   ### Job title | Company
 *   City | 01/2021 – today
 *   - What I did
 *
 * Templates lay out these parts; they never add or change words. Section titles are kept as
 * written, so a German resume keeps "Berufserfahrung".
 */
export interface ResumeEntry {
  kind: 'entry';
  /** "Senior Frontend Engineer" */
  title: string;
  /** "Acme GmbH" */
  org: string | null;
  /** "Berlin | 01/2021 – today" */
  meta: string | null;
  bullets: string[];
  /** Plain lines under the entry that are not bullets. */
  lines: string[];
}

export type ResumeBlock =
  ResumeEntry | { kind: 'paragraph'; text: string } | { kind: 'bullets'; items: string[] };

export interface ResumeSection {
  title: string;
  blocks: ResumeBlock[];
}

export interface ResumeDoc {
  name: string;
  headline: string | null;
  /** Address, phone, email, links: one item each. */
  contact: string[];
  sections: ResumeSection[];
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;
const BULLET = /^\s*[-*•–]\s+(.*)$/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
/** A whole line in bold, like "**BERUFSERFAHRUNG**", is a section title too. */
const BOLD_LINE = /^\*\*([^*]+)\*\*:?$/;
/** Separators in a contact or entry line: " | ", " · ", " • ". */
const SEPARATOR = /\s+[|·•]\s+/;

/** Strips the ```markdown fence Claude sometimes wraps its answer in. */
function unfence(text: string): string {
  return text.replace(/^\s*```[a-z]*\s*\n/i, '').replace(/\n```\s*$/, '');
}

/** Looks like a contact line: has an @, a phone number, a link, or several parts. */
const isContactLine = (line: string) =>
  SEPARATOR.test(line) || /@|https?:\/\/|www\.|linkedin|github|\+?\d[\d\s/-]{6,}/i.test(line);

/**
 * Reads the resume. Text that doesn't follow the layout still comes through: without a
 * "# Name" line, `fallbackName` is used, and lines outside any section go into one without a
 * title.
 */
export function parseResume(markdown: string, fallbackName: string): ResumeDoc {
  const lines = unfence(markdown).replace(/\r\n?/g, '\n').split('\n');
  const doc: ResumeDoc = { name: '', headline: null, contact: [], sections: [] };
  let section: ResumeSection | null = null;
  let entry: ResumeEntry | null = null;
  let inHeader = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    currentSection().blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const currentSection = (): ResumeSection => {
    if (!section) {
      section = { title: '', blocks: [] };
      doc.sections.push(section);
    }
    return section;
  };
  const startSection = (title: string) => {
    flushParagraph();
    entry = null;
    inHeader = false;
    section = { title: title.replace(/:$/, ''), blocks: [] };
    doc.sections.push(section);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (RULE.test(line)) continue;
    if (!line) {
      flushParagraph();
      continue;
    }
    const heading = HEADING.exec(line);
    const level = heading?.[1]?.length ?? 0;
    const text = heading?.[2] ?? '';

    if (level === 1 && !doc.name) {
      doc.name = plain(text);
      inHeader = true;
      continue;
    }
    if (level === 1 || level === 2) {
      startSection(plain(text));
      continue;
    }
    if (level >= 3) {
      flushParagraph();
      inHeader = false;
      const [title = '', ...rest] = text.split(SEPARATOR);
      entry = {
        kind: 'entry',
        title: title.trim(),
        org: rest.join(' | ').trim() || null,
        meta: null,
        bullets: [],
        lines: [],
      };
      currentSection().blocks.push(entry);
      continue;
    }
    const bold = BOLD_LINE.exec(line);
    if (bold && !inHeader) {
      startSection(bold[1] ?? '');
      continue;
    }

    if (inHeader) {
      if (isContactLine(line)) {
        doc.contact.push(
          ...line
            .split(SEPARATOR)
            .map((part) => part.trim())
            .filter(Boolean),
        );
      } else if (!doc.headline) {
        doc.headline = line;
      } else {
        doc.contact.push(line);
      }
      continue;
    }

    const bullet = BULLET.exec(raw);
    if (bullet) {
      flushParagraph();
      const item = (bullet[1] ?? '').trim();
      if (entry) {
        entry.bullets.push(item);
      } else {
        const blocks = currentSection().blocks;
        const last = blocks[blocks.length - 1];
        if (last?.kind === 'bullets') last.items.push(item);
        else blocks.push({ kind: 'bullets', items: [item] });
      }
      continue;
    }
    if (entry && entry.bullets.length === 0 && entry.meta === null && entry.lines.length === 0) {
      entry.meta = line;
      continue;
    }
    if (entry) {
      entry.lines.push(line);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  if (!doc.name) doc.name = fallbackName;
  doc.sections = doc.sections.filter((s) => s.title || s.blocks.length);
  return doc;
}

/** The text without Markdown marks, for names and titles. */
export function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<![\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/** A cover letter's paragraphs, without the Markdown marks around the whole text. */
export function letterParagraphs(text: string): string[] {
  return unfence(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !RULE.test(l))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);
}
