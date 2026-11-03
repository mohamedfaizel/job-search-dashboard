import { plainText } from '../arbeitsagentur/arbeitsagentur.mapper';
import type {
  AshbyFeed,
  BoardEmploymentType,
  BoardPosting,
  GreenhouseFeed,
  LeverPosting,
} from './company-boards.types';

/** "Full-time", "FullTime", "Intern", "Contract"... → our four job types, or null. */
export function employmentTypeOf(text: string | undefined): BoardEmploymentType | null {
  if (!text) return null;
  if (/intern|working student|werkstudent/i.test(text)) return 'internship';
  if (/part[\s-]?time/i.test(text)) return 'part-time';
  if (/full[\s-]?time/i.test(text)) return 'full-time';
  if (/contract|freelance|temporary|temp\b/i.test(text)) return 'contract';
  return null;
}

const looksRemote = (text: string | null | undefined) => (text ? /remote/i.test(text) : false);

/** Greenhouse sends its HTML escaped (&lt;p&gt;), so it is unescaped before the tags go. */
function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const date = (value: string | number | undefined): Date | null => {
  if (value === undefined) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function fromGreenhouse(feed: GreenhouseFeed): BoardPosting[] {
  return (feed.jobs ?? []).flatMap((job) => {
    if (job.id === undefined || !job.title || !job.absolute_url) return [];
    const location = job.location?.name?.trim() || null;
    return [
      {
        id: String(job.id),
        title: job.title,
        url: job.absolute_url,
        company: job.company_name?.trim() || null,
        location,
        remote: looksRemote(location) ? true : null,
        postedAt: date(job.first_published ?? job.updated_at),
        employmentType: null,
        department: job.departments?.[0]?.name ?? null,
        description: plainText(job.content ? unescapeHtml(job.content) : undefined),
        raw: job,
      },
    ];
  });
}

export function fromLever(feed: LeverPosting[]): BoardPosting[] {
  return feed.flatMap((job) => {
    if (!job.id || !job.text || !job.hostedUrl) return [];
    const location = job.categories?.location?.trim() || null;
    const lists = (job.lists ?? [])
      .map((list) => [list.text, plainText(list.content)].filter(Boolean).join('\n'))
      .filter(Boolean);
    const description = [job.descriptionPlain, ...lists, job.additionalPlain]
      .filter(Boolean)
      .join('\n\n');
    return [
      {
        id: job.id,
        title: job.text,
        url: job.hostedUrl,
        company: null,
        location,
        remote:
          job.workplaceType === 'remote' || looksRemote(location)
            ? true
            : job.workplaceType === 'hybrid' || job.workplaceType === 'on-site'
              ? false
              : null,
        postedAt: date(job.createdAt),
        employmentType: employmentTypeOf(job.categories?.commitment),
        department: job.categories?.team ?? null,
        description: description || null,
        raw: job,
      },
    ];
  });
}

export function fromAshby(feed: AshbyFeed): BoardPosting[] {
  return (feed.jobs ?? []).flatMap((job) => {
    if (!job.id || !job.title || !job.jobUrl || job.isListed === false) return [];
    const location = job.location?.trim() || null;
    return [
      {
        id: job.id,
        title: job.title,
        url: job.jobUrl,
        company: null,
        location,
        remote: job.isRemote === true || looksRemote(location) ? true : (job.isRemote ?? null),
        postedAt: date(job.publishedAt),
        employmentType: employmentTypeOf(job.employmentType),
        department: job.department ?? null,
        description: job.descriptionPlain?.trim() || plainText(job.descriptionHtml),
        raw: job,
      },
    ];
  });
}
