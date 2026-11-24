'use client';

import type { AppNotification } from '@jobsearch/data';
import {
  useApproveKeyRequest,
  useDenyKeyRequest,
  useMarkNotificationsRead,
  useNotifications,
  useUndoAutopilot,
} from '@jobsearch/data';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useErrorText } from '../i18n/useErrorText';
import { MAKER } from '../lib/maker';
import { openMessageWindow } from '../lib/message-window';
import { useDismiss } from '../lib/use-dismiss';
import { TipButton } from './TipButton';
import { useToast } from './Toasts';

/** A job's link: Job posts opens its popup. */
export const jobLink = (jobId: string) => `/jobs?job=${encodeURIComponent(jobId)}`;

/** Key pool notifications: their text, and the page they open (admins' or your Settings). */
const KEY_POOL: Partial<
  Record<
    string,
    {
      text:
        | 'keyRequest'
        | 'poolLow'
        | 'keyApproved'
        | 'keyDenied'
        | 'keyEmpty'
        | 'keyLimit'
        | 'keyTakenBack';
      link: string;
    }
  >
> = {
  KEY_REQUEST: { text: 'keyRequest', link: '/admin?tab=keys' },
  POOL_LOW: { text: 'poolLow', link: '/admin?tab=keys' },
  KEY_APPROVED: { text: 'keyApproved', link: '/settings' },
  KEY_DENIED: { text: 'keyDenied', link: '/settings' },
  KEY_EMPTY: { text: 'keyEmpty', link: '/settings' },
  KEY_LIMIT: { text: 'keyLimit', link: '/settings' },
  KEY_TAKEN_BACK: { text: 'keyTakenBack', link: '/settings' },
};

/** A saved search's Autopilot sorted new jobs: queued, hidden, left for you. */
const AUTOPILOT = 'AUTOPILOT';
/** Nightly apply kits: some were written with your AI key, or none could be. */
const KITS_READY = 'KITS_READY';
const KITS_FAILED = 'KITS_FAILED';
const KIT_REASONS = ['NO_KEY', 'KEY_REFUSED', 'NO_RESUME', 'NONE_WRITTEN'] as const;
type KitReason = (typeof KIT_REASONS)[number];
const kitReason = (reason: string | null): KitReason =>
  KIT_REASONS.find((known) => known === reason) ?? 'NONE_WRITTEN';

/** "5 minutes ago", in the app's language. */
export function timeAgo(iso: string, locale: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'minute');
}

/** The notification's first line, in your language. */
function useHeadline() {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  return useCallback(
    (item: AppNotification) => {
      if (item.kind === 'MESSAGE_REPLY') {
        return t('messageReply', { name: item.searchName || MAKER.name });
      }
      const pool = KEY_POOL[item.kind];
      if (pool) return t(pool.text, { name: item.searchName, count: item.count });
      if (item.kind === AUTOPILOT) {
        return t('autopilot', { search: item.searchName, count: item.count });
      }
      if (item.kind === KITS_READY) return t('kitsReady', { count: item.count });
      if (item.kind === KITS_FAILED) return t('kitsFailed');
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

/** A Key pool notification: one line, a link, and ✓ / ✕ for a token request. */
function KeyItem({ item, onOpen }: { item: AppNotification; onOpen: () => void }) {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const headline = useHeadline();
  const errorText = useErrorText();
  const approve = useApproveKeyRequest();
  const deny = useDenyKeyRequest();
  const pool = KEY_POOL[item.kind];
  const answered = approve.isSuccess || deny.isSuccess;
  const error = approve.error ?? deny.error;
  if (!pool) return null;
  return (
    <li className={`space-y-1.5 px-3 py-2.5 ${item.readAt ? '' : 'bg-brand-50'}`}>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm text-slate-900">
          {!item.readAt && (
            <span
              aria-label={t('unread')}
              className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-600"
            />
          )}
          {headline(item)}
        </p>
        {item.kind === 'KEY_REQUEST' && item.refId !== null && !answered && (
          <div className="flex gap-1">
            <TipButton
              tip={t('approve')}
              tone="yes"
              disabled={approve.isPending || deny.isPending}
              onClick={() => {
                if (item.refId !== null) approve.mutate(item.refId);
              }}
            >
              ✓
            </TipButton>
            <TipButton
              tip={t('deny')}
              tone="no"
              disabled={approve.isPending || deny.isPending}
              onClick={() => {
                if (item.refId !== null) deny.mutate({ id: item.refId });
              }}
            >
              ✕
            </TipButton>
          </div>
        )}
      </div>
      {item.kind === 'KEY_DENIED' && item.searchName && (
        <p className="text-xs text-slate-700">{t('keyDeniedNote', { note: item.searchName })}</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {errorText(error)}
        </p>
      )}
      <p className="text-xs text-slate-600">
        {item.kind === 'KEY_REQUEST' && (
          <>{answered ? t('answered') : t('keyRequestHint', { count: item.count })} · </>
        )}
        {timeAgo(item.createdAt, locale)} ·{' '}
        <Link href={pool.link} onClick={onOpen} className="text-brand-700 hover:underline">
          {pool.link.startsWith('/admin') ? t('openKeyPool') : t('openSettings')}
        </Link>
      </p>
    </li>
  );
}

/** One job of a notification, with its Fit % when it has one. */
function JobRow({
  job,
  onOpen,
  showFit,
}: {
  job: AppNotification['jobs'][number];
  onOpen: () => void;
  showFit: boolean;
}) {
  const t = useTranslations('Notifications');
  return (
    <li>
      <Link
        href={jobLink(job.id)}
        onClick={onOpen}
        className="flex items-baseline justify-between gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-100"
      >
        <span className="min-w-0 truncate">
          <b className="font-medium text-slate-900">{job.title}</b>{' '}
          <span className="text-slate-600">· {job.company}</span>
        </span>
        {showFit && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-200 ring-inset">
            {t('fit', { fit: job.fit })}
          </span>
        )}
      </Link>
    </li>
  );
}

/** What Autopilot did after a run, the best queued jobs, and Undo. */
function AutopilotItem({ item, onOpen }: { item: AppNotification; onOpen: () => void }) {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const headline = useHeadline();
  const errorText = useErrorText();
  const undo = useUndoAutopilot();
  const undone = item.undone || undo.isSuccess;
  return (
    <li className={`space-y-1.5 px-3 py-2.5 ${item.readAt ? '' : 'bg-brand-50'}`}>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm text-slate-900">
          {!item.readAt && (
            <span
              aria-label={t('unread')}
              className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-600"
            />
          )}
          {headline(item)}
        </p>
        {undone ? (
          <span className="shrink-0 text-xs text-slate-600">{t('undone')}</span>
        ) : (
          <button
            type="button"
            disabled={undo.isPending}
            onClick={() => {
              undo.mutate(item.id);
            }}
            className="shrink-0 rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('undo')}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-600">
        {t('autopilotHint', { hidden: item.hidden, kept: item.kept })} ·{' '}
        {timeAgo(item.createdAt, locale)}
      </p>
      {!undone && item.jobs.length > 0 && (
        <ul className="space-y-1">
          {item.jobs.map((job) => (
            <JobRow key={job.id} job={job} onOpen={onOpen} showFit />
          ))}
        </ul>
      )}
      {undo.error && (
        <p role="alert" className="text-xs text-red-700">
          {errorText(undo.error)}
        </p>
      )}
      {!undone && item.count > 0 && (
        <Link href="/jobs" onClick={onOpen} className="text-xs text-brand-700 hover:underline">
          {t('openQueue')}
        </Link>
      )}
    </li>
  );
}

/** Nightly apply kits could not be written: why, and where to fix it. */
function KitsFailedItem({ item, onOpen }: { item: AppNotification; onOpen: () => void }) {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const headline = useHeadline();
  const reason = kitReason(item.reason);
  return (
    <li className={`space-y-1 px-3 py-2.5 ${item.readAt ? '' : 'bg-brand-50'}`}>
      <p className="text-sm text-slate-900">
        {!item.readAt && (
          <span
            aria-label={t('unread')}
            className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-600"
          />
        )}
        {headline(item)}
      </p>
      <p className="text-xs text-slate-700">{t(`kitsReason.${reason}`)}</p>
      <p className="text-xs text-slate-600">
        {timeAgo(item.createdAt, locale)}
        {reason !== 'NONE_WRITTEN' && (
          <>
            {' · '}
            <Link
              href={reason === 'NO_RESUME' ? '/profile' : '/settings'}
              onClick={onOpen}
              className="text-brand-700 hover:underline"
            >
              {t('openSettingsKits')}
            </Link>
          </>
        )}
      </p>
    </li>
  );
}

function Item({ item, onOpen }: { item: AppNotification; onOpen: () => void }) {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const headline = useHeadline();
  const interview = item.kind === 'INTERVIEW_SOON';
  const kits = item.kind === KITS_READY;
  if (item.kind === 'MESSAGE_REPLY') {
    return (
      <li className={item.readAt ? '' : 'bg-brand-50'}>
        <button
          type="button"
          onClick={() => {
            onOpen();
            openMessageWindow();
          }}
          className="w-full space-y-1 px-3 py-2.5 text-left hover:bg-slate-100"
        >
          <span className="block text-sm text-slate-900">
            {!item.readAt && (
              <span
                aria-label={t('unread')}
                className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-600"
              />
            )}
            {headline(item)}
          </span>
          <span className="block text-xs text-slate-600">
            {t('messageHint')} · {timeAgo(item.createdAt, locale)}
          </span>
        </button>
      </li>
    );
  }
  return (
    <li className={`space-y-1.5 px-3 py-2.5 ${item.readAt ? '' : 'bg-brand-50'}`}>
      <p className="text-sm text-slate-900">
        {!item.readAt && (
          <span
            aria-label={t('unread')}
            className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-600"
          />
        )}
        {headline(item)}
      </p>
      <p className="text-xs text-slate-600">
        {interview
          ? t('interviewHint')
          : kits
            ? t('kitsHint')
            : t('fitAtLeast', { fit: item.fitMin })}{' '}
        · {timeAgo(item.createdAt, locale)}
      </p>
      {kits && item.failed > 0 && (
        <p className="text-xs text-amber-800">{t('kitsFailedSome', { count: item.failed })}</p>
      )}
      <ul className="space-y-1">
        {item.jobs.map((job) => (
          <JobRow key={job.id} job={job} onOpen={onOpen} showFit={!interview} />
        ))}
      </ul>
      {item.count > item.jobs.length && (
        <Link href="/jobs" onClick={onOpen} className="text-xs text-brand-700 hover:underline">
          {t('more', { count: item.count - item.jobs.length })}
        </Link>
      )}
    </li>
  );
}

/**
 * The 🔔 in the header. Its red badge counts unread notifications; opening the list marks them
 * read. It asks for new ones every minute, and a pop-up (toast) says when one arrives.
 */
export function NotificationBell() {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const toast = useToast();
  const headline = useHeadline();
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = data?.unread ?? 0;

  // A toast for each notification that came in while the app was open (not the old ones).
  const seen = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.items.map((item) => item.id));
    if (seen.current) {
      for (const item of data.items) {
        if (seen.current.has(item.id) || item.readAt) continue;
        const first = item.jobs[0];
        const pool = KEY_POOL[item.kind];
        toast(headline(item), {
          tone: 'info',
          action:
            item.kind === 'MESSAGE_REPLY'
              ? { label: t('show'), onClick: openMessageWindow }
              : pool
                ? {
                    label: t('show'),
                    onClick: () => {
                      router.push(pool.link);
                    },
                  }
                : first
                  ? {
                      label: t('show'),
                      onClick: () => {
                        router.push(jobLink(first.id));
                      },
                    }
                  : undefined,
        });
      }
    }
    seen.current = ids;
  }, [data, toast, t, router, headline]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useDismiss(open, box, close);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? t('bellUnread', { count: unread }) : t('bell')}
        onClick={() => {
          setOpen((was) => !was);
          if (!open && unread) markRead.mutate();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-lg text-neutral-200 hover:bg-neutral-800 hover:text-white"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-1 right-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-semibold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="fixed inset-x-4 top-16 z-50 overflow-hidden md:absolute md:inset-x-auto md:top-auto md:right-0 md:mt-2 md:w-[22rem] rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl"
        >
          <p className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">{t('title')}</p>
          {data?.items.length ? (
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {data.items.map((item) =>
                item.kind === KITS_FAILED ? (
                  <KitsFailedItem
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      setOpen(false);
                    }}
                  />
                ) : item.kind === AUTOPILOT ? (
                  <AutopilotItem
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      setOpen(false);
                    }}
                  />
                ) : KEY_POOL[item.kind] ? (
                  <KeyItem
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      setOpen(false);
                    }}
                  />
                ) : (
                  <Item
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      setOpen(false);
                    }}
                  />
                ),
              )}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-slate-600">{t('empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}
