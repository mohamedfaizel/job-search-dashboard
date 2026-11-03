import type { Ats, BoardRef } from './company-boards.types';
import { ATS_NAMES } from './company-boards.types';

const SLUG = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/** Career-page addresses, by host, and which tool each belongs to. */
const HOSTS: Record<string, Ats> = {
  'boards.greenhouse.io': 'greenhouse',
  'job-boards.greenhouse.io': 'greenhouse',
  'jobs.lever.co': 'lever',
  'jobs.ashbyhq.com': 'ashby',
};

/**
 * Reads one board from what you typed: "greenhouse:stripe", or the address of its career page,
 * e.g. https://jobs.lever.co/netflix. Returns null when it is neither.
 */
export function parseBoard(entry: string): BoardRef | null {
  const text = entry.trim();
  const named = /^([a-z]+)\s*:\s*([^\s/]+)$/i.exec(text);
  if (named?.[1] && named[2]) {
    const ats = named[1].toLowerCase();
    const known = ATS_NAMES.find((name) => name === ats);
    return known && SLUG.test(named[2]) ? { ats: known, slug: named[2].toLowerCase() } : null;
  }
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const ats = HOSTS[url.hostname.toLowerCase()];
    const slug = url.pathname.split('/').find(Boolean);
    return ats && slug && SLUG.test(slug) ? { ats, slug: slug.toLowerCase() } : null;
  } catch {
    return null;
  }
}

/** "greenhouse:stripe". The id of a board in our own data. */
export const boardKey = ({ ats, slug }: BoardRef) => `${ats}:${slug}`;

/** "my-company_inc" → "My Company Inc": a readable name when the feed has none. */
export function companyNameFromSlug(slug: string): string {
  return slug
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
