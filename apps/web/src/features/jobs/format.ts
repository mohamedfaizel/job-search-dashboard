import type { ApplicationStatus, Workplace } from '@jobsearch/data';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export const WORKPLACE_LABELS: Record<Workplace, string> = {
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
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
