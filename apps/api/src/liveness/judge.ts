/**
 * Decides from one fetched page whether a job ad is still open. Pure, so it is easy to test.
 *
 * It only says CLOSED when the signal is clear (the page is gone, it says so, or the site sent
 * us to its home page). A site that blocks robots, or a page we can't read, is UNKNOWN: the job
 * keeps its status and you can still open the link yourself.
 */

export type CheckResult = 'OPEN' | 'CLOSED' | 'UNKNOWN';

/** Why the check decided what it did. The web app shows each code as a sentence. */
export type CheckReason =
  | 'LOOKS_OPEN'
  | 'NOT_FOUND'
  | 'SAYS_CLOSED'
  | 'REDIRECTED'
  | 'BLOCKED'
  | 'SERVER_ERROR'
  | 'NO_CONTENT'
  | 'TIMEOUT'
  | 'UNREACHABLE'
  | 'NO_LINK';

export interface Verdict {
  result: CheckResult;
  reason: CheckReason;
}

export interface FetchedPage {
  /** The HTTP status of the last response. */
  status: number;
  /** The link we were asked to check. */
  url: string;
  /** Where the redirects ended. */
  finalUrl: string;
  /** The response body (HTML or text). */
  body: string;
}

/**
 * Sentences job sites show on a closed ad, in English and German. Matched on the page text in
 * lower case, so keep them lower case and specific: a phrase that could appear in a "similar
 * jobs" box on an open ad would mark open jobs closed.
 */
export const CLOSED_PHRASES = [
  // English
  'no longer accepting applications',
  'job is no longer available',
  'job you are looking for is no longer',
  'position is no longer available',
  'position has been filled',
  'this job has expired',
  'this job posting has expired',
  'this posting has expired',
  'job posting is no longer active',
  'this job is closed',
  'this position is closed',
  'this vacancy is closed',
  'vacancy has been filled',
  'applications for this job are closed',
  'this role is no longer open',
  'job not found',
  'the job you were looking for',
  // German
  'nicht mehr verfügbar',
  'stellenanzeige ist abgelaufen',
  'stellenanzeige ist nicht mehr',
  'stelle ist bereits besetzt',
  'stelle wurde bereits besetzt',
  'stelle ist leider nicht mehr',
  'nicht mehr ausgeschrieben',
  'nicht mehr online',
  'anzeige ist nicht mehr aktiv',
  'stellenangebot ist nicht mehr',
  'bewerbungsfrist ist abgelaufen',
];

/** Words in a URL that mean a site sent us to an error or "expired" page. */
const CLOSED_URL = /[/?=&_-](expired|job-?not-?found|not-?found|404|error|closed)(\b|[/?=&_-])/i;
/** Redirects to a sign-in page tell us nothing about the job. */
const LOGIN_URL = /(login|signin|sign-in|auth|checkpoint|captcha|consent)/i;

/** Pages with less readable text than this are probably built by JavaScript we don't run. */
const MIN_TEXT = 200;

/** The page's readable text, lower case, without scripts, styles and tags. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&uuml;/g, 'ü')
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when `final` is the site's home page but `original` pointed deeper into it. */
function sentHome(original: URL, final: URL): boolean {
  const isHome = (u: URL) => u.pathname.replace(/\/+$/, '') === '' && u.search === '';
  return isHome(final) && !isHome(original);
}

export function judge(page: FetchedPage): Verdict {
  const { status } = page;
  if (status === 404 || status === 410) return { result: 'CLOSED', reason: 'NOT_FOUND' };
  // 401/403/429 and LinkedIn's 999: the site keeps robots out.
  if (status === 401 || status === 403 || status === 429 || status === 999) {
    return { result: 'UNKNOWN', reason: 'BLOCKED' };
  }
  if (status >= 500) return { result: 'UNKNOWN', reason: 'SERVER_ERROR' };
  if (status >= 400) return { result: 'UNKNOWN', reason: 'BLOCKED' };

  let original: URL | null = null;
  let final: URL | null = null;
  try {
    original = new URL(page.url);
    final = new URL(page.finalUrl);
  } catch {
    // Not a URL we can compare; the page text still counts.
  }
  if (original && final && original.href !== final.href) {
    if (LOGIN_URL.test(final.pathname + final.search))
      return { result: 'UNKNOWN', reason: 'BLOCKED' };
    if (
      CLOSED_URL.test(final.pathname + final.search) &&
      !CLOSED_URL.test(original.pathname + original.search)
    ) {
      return { result: 'CLOSED', reason: 'REDIRECTED' };
    }
    if (sentHome(original, final)) return { result: 'CLOSED', reason: 'REDIRECTED' };
  }

  const text = pageText(page.body.slice(0, 1_000_000));
  if (CLOSED_PHRASES.some((phrase) => text.includes(phrase))) {
    return { result: 'CLOSED', reason: 'SAYS_CLOSED' };
  }
  if (text.length < MIN_TEXT) return { result: 'UNKNOWN', reason: 'NO_CONTENT' };
  return { result: 'OPEN', reason: 'LOOKS_OPEN' };
}
