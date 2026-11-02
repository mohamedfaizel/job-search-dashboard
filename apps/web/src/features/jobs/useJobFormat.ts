import type { ApplicationStatus, VisaSponsorship, Workplace } from '@jobsearch/data';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

function displayName(names: Intl.DisplayNames, code: string): string {
  try {
    return names.of(code) ?? code;
  } catch {
    // Not a valid code (e.g. typed by hand): show it as it is.
    return code;
  }
}

/**
 * Words and numbers about a job in the language you picked: dates, salaries, "3 d ago", status
 * names and country names. One hook, so every part of the jobs screen formats them the same way.
 */
export function useJobFormat() {
  const locale = useLocale();
  const t = useTranslations('Jobs');
  const format = useFormatter();

  return useMemo(() => {
    // The browser knows every country and language name, so we store only the ISO codes.
    const countries = new Intl.DisplayNames([locale], { type: 'region' });
    const languages = new Intl.DisplayNames([locale], { type: 'language' });
    const thousands = (value: number) => t('format.thousands', { n: Math.round(value / 1000) });

    return {
      /** "Nov 2, 2026" / "2. Nov. 2026". */
      date: (iso: string) =>
        format.dateTime(new Date(iso), { month: 'short', day: 'numeric', year: 'numeric' }),

      /** "$215k - $290k", "$90k+", "Up to $120k", or "" when unknown. */
      salary: (min: number | null, max: number | null): string => {
        if (min !== null && max !== null) {
          return min === max
            ? thousands(min)
            : t('format.range', { min: thousands(min), max: thousands(max) });
        }
        if (min !== null) return t('format.from', { min: thousands(min) });
        if (max !== null) return t('format.upTo', { max: thousands(max) });
        return '';
      },

      /** "Today", "1 d ago", "3 w ago", "5 mo ago": how long ago a job was posted. */
      timeAgo: (iso: string, now = Date.now()): string => {
        const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
        if (days < 1) return t('format.today');
        if (days < 14) return t('format.days', { n: days });
        if (days < 60) return t('format.weeks', { n: Math.floor(days / 7) });
        if (days < 365) return t('format.months', { n: Math.floor(days / 30) });
        return t('format.years', { n: Math.floor(days / 365) });
      },

      status: (status: ApplicationStatus) => t(`status.${status}`),
      visa: (visa: VisaSponsorship) => t(`visa.${visa}`),
      workplace: (workplace: Workplace) => t(`workplace.${workplace}`),

      /** "DE" → "Germany" / "Deutschland". */
      country: (code: string) => displayName(countries, code.toUpperCase()),
      /** "de" → "German" / "Deutsch". */
      language: (code: string) => displayName(languages, code.toLowerCase()),

      /**
       * The German level a job asks for: "B2" when the ad names it, "about C1" when it is read
       * from words like "fließend", "" when the ad says nothing about the level.
       */
      germanLevel: (insights: { germanLevel: string | null; germanLevelEstimated: boolean }) => {
        if (!insights.germanLevel) return '';
        return insights.germanLevelEstimated
          ? t('format.aboutLevel', { level: insights.germanLevel })
          : insights.germanLevel;
      },
      /** Tooltip for an estimated German level. */
      estimatedLevelHint: t('format.estimatedLevelHint'),

      /** "Senior Engineer at Acme", so a screen reader knows which row a button belongs to. */
      jobName: (job: { title: string; company: { name: string } }) =>
        t('jobName', { title: job.title, company: job.company.name }),
    };
  }, [locale, t, format]);
}

export type JobFormat = ReturnType<typeof useJobFormat>;
