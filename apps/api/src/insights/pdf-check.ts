import { extractText, getDocumentProxy } from 'unpdf';
import { mentions } from './skills';

/**
 * What the PDF check looks at, the way an ATS reads the file: only its text layer. Modelled on
 * ai-job-search's verify_pdf step.
 */
export type PdfCheckCode =
  'PAGES' | 'TEXT' | 'EMAIL' | 'DATES' | 'CHARACTERS' | 'PLACEHOLDERS' | 'SKILLS';

export interface PdfCheckItem {
  code: PdfCheckCode;
  ok: boolean;
  /** What was found, for the message: "3 pages (aim for 2)", "kubernetes, graphql", "01/2020 – today". */
  detail: string;
}

export interface PdfCheckInput {
  /** The text an ATS gets out of the PDF. */
  text: string;
  pages: number;
  /** Your name and e-mail as on your account: both must be readable text. */
  name: string;
  email: string;
  /** 1 page under three years of experience, else 2. */
  maxPages: number;
  /** Job skills the resume text names: each must still be in the PDF's text. */
  skills: string[];
}

/**
 * A long dash between two dates, which some ATS (Workday) read as a broken date: "01/2020 – today",
 * "Jan 2022 – Aug 2022", "2013—2017".
 */
export const LONG_DASH_DATE =
  /(?:\d{1,2}[./])?\d{4}\s*[–—―‒]\s*(?:(?:\p{L}{3,9}\.?\s+)?(?:\d{1,2}[./])?\d{4}|today|present|now|heute|current|jetzt)/giu;

/** Text left for you to fill in, which must never reach an employer. */
const PLACEHOLDER =
  /\((?:fill in|to fill|ausfüllen|bitte ergänzen)[^)]*\)|\bTBD\b|\bTODO\b|\[(?:company|name|date|year|school|firma|datum)[^\]]*\]|lorem ipsum/giu;

/**
 * Characters that come out wrong when an ATS copies the text: ligatures ("ﬁ" for "fi"), the
 * replacement character, and private-use icons (Font Awesome phones and envelopes).
 */
const BAD_CHARACTERS = /[ﬀ-ﬆ�-]/gu;

/** Reads the text layer and page count of a PDF, as an ATS would. */
export async function readPdf(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text, pages: totalPages };
}

/** Text with all whitespace removed, for finding an e-mail that the PDF split with spaces. */
const squash = (text: string) => text.replace(/\s+/g, '').toLowerCase();

const unique = (items: string[]) => [...new Set(items)];

/** Checks the text an ATS gets from your finished resume PDF. */
export function checkPdf(input: PdfCheckInput): PdfCheckItem[] {
  const { text, pages, maxPages } = input;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const name = input.name.trim();
  const nameFound = !name || squash(text).includes(squash(name));
  const email = input.email.trim().toLowerCase();
  const dashDates = unique([...text.matchAll(LONG_DASH_DATE)].map((m) => m[0]));
  const badCharacters = unique([...text.matchAll(BAD_CHARACTERS)].map((m) => m[0]));
  const placeholders = unique([...text.matchAll(PLACEHOLDER)].map((m) => m[0]));
  const lost = input.skills.filter((skill) => !mentions(text, skill));

  return [
    {
      code: 'PAGES',
      ok: pages > 0 && pages <= maxPages,
      detail: `${String(pages)}/${String(maxPages)}`,
    },
    // A scanned or image-only PDF has (almost) no text: an ATS sees an empty resume.
    { code: 'TEXT', ok: words >= 80 && nameFound, detail: String(words) },
    { code: 'EMAIL', ok: !email || squash(text).includes(email), detail: email },
    { code: 'DATES', ok: dashDates.length === 0, detail: dashDates.slice(0, 3).join(', ') },
    {
      code: 'CHARACTERS',
      ok: badCharacters.length === 0,
      detail: badCharacters
        .map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase()}`)
        .join(', '),
    },
    {
      code: 'PLACEHOLDERS',
      ok: placeholders.length === 0,
      detail: placeholders.slice(0, 3).join(', '),
    },
    { code: 'SKILLS', ok: lost.length === 0, detail: lost.join(', ') },
  ];
}
