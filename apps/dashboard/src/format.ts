import type { ApplicationStatus, Workplace } from '@jobsearch/data';

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
