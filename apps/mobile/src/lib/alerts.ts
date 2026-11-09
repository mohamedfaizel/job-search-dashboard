import type { AppNotification } from '@jobsearch/data';
import { useCallback } from 'react';
import { useLocale, useTranslations } from 'use-intl';

/** The notifications that came in since the last check: unread, and not seen before. */
export function freshAlerts(
  items: AppNotification[],
  seen: ReadonlySet<number>,
): AppNotification[] {
  return items.filter((item) => item.readAt === null && !seen.has(item.id));
}

/** Where tapping a phone alert takes you: the job for an interview, else the list of alerts. */
export function alertLink(item: AppNotification): string {
  const first = item.jobs[0];
  return item.kind === 'INTERVIEW_SOON' && first ? `/job/${first.id}` : '/alerts';
}

/** A notification's first line, in your language, the same words as the website's bell. */
export function useHeadline() {
  const t = useTranslations('Alerts');
  const locale = useLocale();
  return useCallback(
    (item: AppNotification) =>
      item.kind === 'INTERVIEW_SOON' && item.at
        ? t('interviewSoon', {
            when: new Intl.DateTimeFormat(locale, {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(item.at)),
          })
        : t('newMatches', { count: item.count, search: item.searchName }),
    [t, locale],
  );
}
