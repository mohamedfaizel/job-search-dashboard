import type { AppNotification } from '@jobsearch/data';
import { useCallback } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import { MAKER } from './maker';

/** The notifications that came in since the last check: unread, and not seen before. */
export function freshAlerts(
  items: AppNotification[],
  seen: ReadonlySet<number>,
): AppNotification[] {
  return items.filter((item) => item.readAt === null && !seen.has(item.id));
}

/**
 * Where tapping a phone alert takes you: the message window for an answer, the job for an
 * interview, else the list of alerts.
 */
export function alertLink(item: AppNotification): string {
  if (item.kind === 'MESSAGE_REPLY') return '/messages';
  const first = item.jobs[0];
  return item.kind === 'INTERVIEW_SOON' && first ? `/job/${first.id}` : '/alerts';
}

/** Key pool notifications: one line each, no jobs. */
const KEY_POOL_TEXT: Partial<
  Record<
    string,
    | 'keyRequest'
    | 'poolLow'
    | 'keyApproved'
    | 'keyDenied'
    | 'keyEmpty'
    | 'keyLimit'
    | 'keyTakenBack'
  >
> = {
  KEY_REQUEST: 'keyRequest',
  POOL_LOW: 'poolLow',
  KEY_APPROVED: 'keyApproved',
  KEY_DENIED: 'keyDenied',
  KEY_EMPTY: 'keyEmpty',
  KEY_LIMIT: 'keyLimit',
  KEY_TAKEN_BACK: 'keyTakenBack',
};

/** A notification's first line, in your language, the same words as the website's bell. */
export function useHeadline() {
  const t = useTranslations('Alerts');
  const locale = useLocale();
  return useCallback(
    (item: AppNotification) => {
      if (item.kind === 'MESSAGE_REPLY') {
        return t('messageReply', { name: item.searchName || MAKER.name });
      }
      const key = KEY_POOL_TEXT[item.kind];
      if (key) return t(key, { name: item.searchName, count: item.count });
      if (item.kind === 'KITS_READY') return t('kitsReady', { count: item.count });
      if (item.kind === 'BRIEFING' && item.briefing) {
        const b = item.briefing;
        const parts = [
          b.newJobs ? t('bNewJobs', { count: b.newJobs }) : '',
          b.kits ? t('bKits', { count: b.kits }) : '',
          b.interviews ? t('bInterviews', { count: b.interviews }) : '',
          b.followUps ? t('bFollowUps', { count: b.followUps }) : '',
          b.replies ? t('bReplies', { count: b.replies }) : '',
        ].filter(Boolean);
        return parts.length ? t('briefing', { parts: parts.join(', ') }) : t('briefingNothing');
      }
      if (item.kind === 'KITS_FAILED') return t('kitsFailed');
      if (item.kind === 'AUTOPILOT') {
        return t('autopilot', { search: item.searchName, count: item.count });
      }
      return item.kind === 'INTERVIEW_SOON' && item.at
        ? t('interviewSoon', {
            when: new Intl.DateTimeFormat(locale, {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(item.at)),
          })
        : t('newMatches', { count: item.count, search: item.searchName });
    },
    [t, locale],
  );
}
