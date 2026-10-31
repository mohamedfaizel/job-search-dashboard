import type { PDFFont, PDFPage } from 'pdf-lib';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// A4 in points, with 2 cm margins.
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56.7;
const WIDTH = PAGE.width - 2 * MARGIN;

const STYLES = {
  name: { size: 18, bold: true, gap: 6 },
  heading: { size: 11.5, bold: true, gap: 10 },
  body: { size: 10, bold: false, gap: 2 },
} as const;
type Style = keyof typeof STYLES;

/**
 * The built-in PDF fonts only know WinAnsi characters (Latin with ä ö ü ß é, € and •). Claude's
 * replies use a few others, so those become their nearest plain version instead of breaking.
 */
export function toWinAnsi(text: string): string {
  return text
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[→⇒]/g, '->')
    .replace(/[▪◦●·]/g, '•')
    .replace(/\xa0/g, ' ')
    .replace(/[^\n\x20-\x7e\xa0-\xff€•]/g, '');
}

/** One Markdown-ish line of the resume as a style and its text, without the Markdown marks. */
export function parseLine(
  line: string,
  first: boolean,
): { style: Style; text: string; bullet: boolean } {
  const text = line.trim();
  const heading = /^#{1,6}\s+(.*)$/.exec(text);
  const bullet = /^[-*•]\s+(.*)$/.exec(text);
  const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1');
  if (heading)
    return { style: first ? 'name' : 'heading', text: plain(heading[1] ?? ''), bullet: false };
  // A line in bold capitals, such as "**BERUFSERFAHRUNG**", is a heading too.
  if (/^\*\*[^*]+\*\*$/.test(text) && !first) {
    return { style: 'heading', text: plain(text), bullet: false };
  }
  if (bullet) return { style: 'body', text: plain(bullet[1] ?? ''), bullet: true };
  return { style: first ? 'name' : 'body', text: plain(text), bullet: false };
}

/** Breaks a paragraph into lines that fit the width. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A plain, ATS-friendly PDF of a resume or cover letter written in Markdown: one column, real
 * text (no images), headings in bold. The first line is the name, set larger.
 */
export async function textToPdf(text: string, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator('Job Search Dashboard');
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const newPageIfNeeded = (height: number) => {
    if (y - height >= MARGIN) return;
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  let first = true;
  for (const raw of toWinAnsi(text).split('\n')) {
    if (!raw.trim()) {
      y -= 6;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) continue; // Markdown rules
    const { style, text: line, bullet } = parseLine(raw, first);
    first = false;
    const { size, bold, gap } = STYLES[style];
    const font = bold ? fonts.bold : fonts.regular;
    const indent = bullet ? 12 : 0;
    const leading = size * 1.35;
    y -= gap;
    for (const [i, part] of wrap(line, font, size, WIDTH - indent).entries()) {
      newPageIfNeeded(leading);
      y -= leading;
      if (bullet && i === 0) {
        page.drawText('•', { x: MARGIN + 2, y, size, font });
      }
      page.drawText(part, { x: MARGIN + indent, y, size, font, color: rgb(0.1, 0.1, 0.12) });
    }
    if (style === 'heading') {
      page.drawLine({
        start: { x: MARGIN, y: y - 3 },
        end: { x: MARGIN + WIDTH, y: y - 3 },
        thickness: 0.5,
        color: rgb(0.75, 0.75, 0.78),
      });
      y -= 4;
    }
  }
  return doc.save();
}

/** "Mohamed Faizel" and "Computer Futures GmbH" → "Mohamed-Faizel-Resume-ComputerFutures.pdf". */
export function pdfFileName(name: string | null, kind: 'Resume' | 'Cover-letter', company: string) {
  const person = (name ?? '').trim().split(/\s+/).filter(Boolean).join('-');
  const firm = company
    .replace(/\b(gmbh|ag|se|kg|ltd|inc|llc|co)\b\.?/gi, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
  return [person, kind, firm].filter(Boolean).join('-') + '.pdf';
}
