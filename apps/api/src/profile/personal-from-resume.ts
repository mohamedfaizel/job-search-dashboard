import { textToBuilderDoc } from '../resume-builder/builder-doc';

/** The My profile > Personal fields a resume upload can fill in. */
export interface PersonalDetails {
  firstName: string;
  lastName: string;
  headline: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  websiteUrl: string;
}

/** Contact details sit at the top; a phone number further down is usually someone else's. */
const TOP_LINES = 15;
// +49 30 1234567, (030) 123-4567, 0176 12345678: 7 digits or more, with the usual separators.
const PHONE = /(?:\+|00)?\(?\d[\d\s()/.-]{6,}\d/;
const URL = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s|,;)]*)?/gi;
const EMAIL = /\S+@\S+\.\S+/g;
/** 01/2021, 2019 - 2021: dates, which look like phone numbers to a regex. */
const DATES = /\b\d{1,2}[/.](19|20)\d{2}\b|\b(19|20)\d{2}\s*[-–]/;
/** Personal sites use these; "Node.js" or "ASP.NET" in a skills line are not web addresses. */
const SITE_ENDINGS =
  /\.(com|dev|io|me|de|net|org|app|eu|co|uk|info|page|site|tech|ch|at|in)(\/|$)/i;

/** "linkedin.com/in/ada" → "https://linkedin.com/in/ada". */
const withScheme = (url: string) =>
  /^https?:\/\//i.test(url) ? url.replace(/[.,]$/, '') : `https://${url.replace(/[.,]$/, '')}`;

function findPhone(lines: string[]): string {
  for (const line of lines) {
    const match = PHONE.exec(line.replace(EMAIL, ' '));
    if (!match || DATES.test(match[0])) continue;
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) return match[0].trim();
  }
  return '';
}

/** Every web address in the text (not email addresses), with https:// in front. */
function findUrls(text: string): string[] {
  return [...text.replace(EMAIL, ' ').matchAll(URL)]
    .map((m) => m[0])
    .filter((url) => /[a-z]/i.test(url.split('.').at(-1) ?? '') && !/^\d/.test(url))
    .map(withScheme);
}

/**
 * Reads your name, headline, phone and links from a resume, for My profile > Personal. Anything
 * it can't find stays empty; the caller only fills fields you left empty.
 */
export function personalFromResume(text: string): PersonalDetails {
  const doc = textToBuilderDoc(text, '');
  const [firstName = '', ...rest] = doc.name.trim().split(/\s+/);
  const top = [doc.contact.join(' | '), ...text.split(/\r?\n/).slice(0, TOP_LINES)];
  const urls = findUrls([doc.contact.join(' '), text].join('\n'));
  const linkedin = urls.find((u) => /linkedin\.com\//i.test(u)) ?? '';
  const github = urls.find((u) => /github\.com\//i.test(u)) ?? '';
  const website =
    findUrls(top.join('\n')).find(
      (u) => !/linkedin\.com|github\.com|xing\.com/i.test(u) && SITE_ENDINGS.test(u),
    ) ?? '';
  return {
    firstName: doc.name.includes('@') ? '' : firstName,
    lastName: doc.name.includes('@') ? '' : rest.join(' '),
    headline: doc.headline.trim(),
    phone: findPhone(top),
    linkedinUrl: linkedin,
    githubUrl: github,
    websiteUrl: website,
  };
}

/** Only the fields that are empty on your profile and found in the resume. */
export function fillEmpty(
  current: PersonalDetails,
  found: PersonalDetails,
): Partial<PersonalDetails> {
  const fill: Partial<PersonalDetails> = {};
  for (const key of Object.keys(found) as (keyof PersonalDetails)[]) {
    if (!current[key].trim() && found[key]) fill[key] = found[key];
  }
  return fill;
}
