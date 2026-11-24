import {
  CALENDAR_CONNECT_URL,
  useDisconnectGoogleCalendar,
  useGoogleCalendar,
  useMe,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

const RESULTS = ['connected', 'denied', 'error', 'not-configured'] as const;
type Result = (typeof RESULTS)[number];

/** What Google's sign-in left in the address (?calendar=connected). Only reads. */
function cameBackWith(): Result | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('calendar');
  return RESULTS.find((known) => known === value) ?? null;
}

function clearCameBack(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('calendar')) return;
  url.searchParams.delete('calendar');
  window.history.replaceState(null, '', url);
}

/**
 * Settings > Gmail > Google Calendar: once connected, each interview date you set becomes an
 * event in your calendar, with the job link and your prep notes. It moves and goes away with
 * the date.
 */
export function GoogleCalendarCard() {
  const t = useTranslations('Settings.calendar');
  const errorText = useErrorText();
  const isAdmin = useMe().data?.role === 'ADMIN';
  const status = useGoogleCalendar();
  const disconnect = useDisconnectGoogleCalendar();
  const [result] = useState(cameBackWith);
  useEffect(clearCameBack, []);

  return (
    <section
      aria-labelledby="calendar-title"
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 id="calendar-title" className="text-base font-semibold text-slate-900">
        {t('title')}
      </h2>
      <p className="text-sm text-slate-600">{t('intro')}</p>

      {result && (
        <p
          role={result === 'connected' ? 'status' : 'alert'}
          className={`rounded-md border p-3 text-sm ${
            result === 'connected'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {t(`result.${result}`)}
        </p>
      )}

      {status.isPending ? (
        <p className="text-sm text-slate-600">{t('loading')}</p>
      ) : status.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {errorText(status.error)}
        </p>
      ) : status.data.email ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              📅 {t('connectedAs', { email: status.data.email })}
            </p>
            {status.data.lastError && (
              <p role="alert" className="text-xs text-red-700">
                {status.data.lastError}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={disconnect.isPending}
            onClick={() => {
              disconnect.mutate();
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {t('disconnect')}
          </button>
        </div>
      ) : status.data.configured ? (
        <a
          href={CALENDAR_CONNECT_URL}
          className="bg-brand-600 hover:bg-brand-700 inline-block rounded-md px-3 py-2 text-sm font-medium text-white"
        >
          {t('connect')}
        </a>
      ) : (
        <p className="text-sm text-amber-800">{isAdmin ? t('notConfigured') : t('notAvailable')}</p>
      )}
      {disconnect.error && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(disconnect.error)}
        </p>
      )}
      <p className="text-xs text-slate-600">{t('privacy')}</p>
    </section>
  );
}
