'use client';

import type { AppNotification } from '@jobsearch/data';
import { useMarkNotificationsRead, useNotifications } from '@jobsearch/data';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useToast } from './Toasts';

/** A job's link: Job posts opens its popup. */
export const jobLink = (jobId: string) => `/jobs?job=${encodeURIComponent(jobId)}`;

/** "5 minutes ago", in the app's language. */
function timeAgo(iso: string, locale: string, now = Date.now()): string {
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

function Item({ item, onOpen }: { item: AppNotification; onOpen: () => void }) {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  return (
    <li className={`space-y-1.5 px-3 py-2.5 ${item.readAt ? '' : 'bg-brand-50'}`}>
      <p className="text-sm text-slate-900">
        {!item.readAt && (
          <span
            aria-label={t('unread')}
            className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-600"
          />
        )}
        {t('newMatches', { count: item.count, search: item.searchName })}
      </p>
      <p className="text-xs text-slate-500">
        {t('fitAtLeast', { fit: item.fitMin })} · {timeAgo(item.createdAt, locale)}
      </p>
      <ul className="space-y-1">
        {item.jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={jobLink(job.id)}
              onClick={onOpen}
              className="flex items-baseline justify-between gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-100"
            >
              <span className="min-w-0 truncate">
                <b className="font-medium text-slate-900">{job.title}</b>{' '}
                <span className="text-slate-600">· {job.company}</span>
              </span>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-200 ring-inset">
                {t('fit', { fit: job.fit })}
              </span>
            </Link>
          </li>
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
        toast(t('newMatches', { count: item.count, search: item.searchName }), {
          tone: 'info',
          action: first
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
  }, [data, toast, t, router]);

  // Close on a click outside or on Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
              {data.items.map((item) => (
                <Item
                  key={item.id}
                  item={item}
                  onOpen={() => {
                    setOpen(false);
                  }}
                />
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-slate-600">{t('empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}
