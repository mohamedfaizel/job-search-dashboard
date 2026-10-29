import type { ApplicationStatus, VisaSponsorship, Workplace } from '@jobsearch/data';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

function thousands(value: number): string {
  return `$${Math.round(value / 1000)}k`;
}

/** "$215k - $290k", "$90k+", "Up to $120k", or "" when unknown. */
export function formatSalary(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return min === max ? thousands(min) : `${thousands(min)} - ${thousands(max)}`;
  }
  if (min !== null) return `${thousands(min)}+`;
  if (max !== null) return `Up to ${thousands(max)}`;
  return '';
}

export const WORKPLACE_LABELS: Record<Workplace, string> = {
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

/** Short words for the Visa column and its filter. */
export const VISA_LABELS: Record<VisaSponsorship, string> = {
  OFFERS: 'Visa support',
  NO: 'No sponsorship',
  NOT_STATED: 'Not stated',
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  NONE: 'Not applied',
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEWING: 'Interviewing',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
};

/** "senior" → "Senior", "node.js" stays as is. */
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// The browser knows every country and language name, so we store only the ISO codes.
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

function displayName(names: Intl.DisplayNames, code: string): string {
  try {
    return names.of(code) ?? code;
  } catch {
    // Not a valid code (e.g. typed by hand): show it as it is.
    return code;
  }
}

/** "DE" → "Germany". */
export function countryName(code: string): string {
  return displayName(countryNames, code.toUpperCase());
}

/** "de" → "German". */
export function languageName(code: string): string {
  return displayName(languageNames, code.toLowerCase());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today", "1 d ago", "3 w ago", "5 mo ago": how long ago a job was posted. */
export function timeAgo(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days < 1) return 'Today';
  if (days < 14) return `${days} d ago`;
  if (days < 60) return `${Math.floor(days / 7)} w ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} y ago`;
}
