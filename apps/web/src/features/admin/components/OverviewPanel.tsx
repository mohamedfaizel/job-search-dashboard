'use client';

import type { AdminOverview, HealthCheck } from '@jobsearch/data';
import { useAdminOverview } from '@jobsearch/data';
import { useFormatter, useTranslations } from 'next-intl';
import { useErrorText } from '@/i18n/useErrorText';

const MARK = {
  OK: { sign: '✓', color: 'bg-emerald-700' },
  DOWN: { sign: '!', color: 'bg-amber-700' },
  OFF: { sign: '–', color: 'bg-slate-500' },
} as const;

/**
 * Admin › Overview: how many people use the app, imports today and this week, and whether each
 * part of the server runs. Counts only. Setup hints (.env, pnpm commands) show only here.
 */
export function OverviewPanel() {
  const t = useTranslations('Admin.overview');
  const errorText = useErrorText();
  const overview = useAdminOverview();

  if (overview.isPending) return <p className="text-sm text-slate-600">{t('loading')}</p>;
  if (overview.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(overview.error)}
      </p>
    );
  }
  const o = overview.data;

  return (
    <div className="space-y-4">
      <Stats overview={o} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="health-heading"
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="health-heading" className="text-base font-semibold text-slate-900">
              {t('healthHeading')}
            </h2>
            <button
              type="button"
              disabled={overview.isFetching}
              onClick={() => {
                void overview.refetch();
              }}
              className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {overview.isFetching ? t('checking') : t('checkAgain')}
            </button>
          </div>
          <ul className="mt-2">
            {o.health.map((check) => (
              <HealthRow key={check.service} check={check} />
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">{t('healthNote')}</p>
        </section>
        <Week week={o.week} />
      </div>
    </div>
  );
}

function Stats({ overview: o }: { overview: AdminOverview }) {
  const t = useTranslations('Admin.overview');
  const stats = [
    { label: t('users'), value: String(o.users), note: t('usersNote', { count: o.newThisWeek }) },
    { label: t('active'), value: String(o.activeThisWeek), note: t('activeNote') },
    {
      label: t('keys'),
      value: t('keysValue', { count: o.withJobKey, total: o.users }),
      note: t('keysNote', { count: o.users - o.withJobKey }),
    },
    {
      label: t('imports'),
      value: String(o.importsToday),
      note: t('importsNote', { count: o.jobsAddedToday }),
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4"
        >
          <dt className="text-xs text-slate-600">{stat.label}</dt>
          <dd className="text-2xl font-bold text-slate-900 tabular-nums">{stat.value}</dd>
          <dd className="text-xs text-slate-600">{stat.note}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What to say about one part: running, how to fix it, or why it is off. */
function useHealthText() {
  const t = useTranslations('Admin.overview.state');
  const format = useFormatter();
  return (check: HealthCheck): string => {
    const { service, state } = check;
    if (service === 'SCHEDULER' || service === 'STILL_OPEN') {
      if (state === 'OFF') return t(check.offInEnv ? 'offEnv' : 'offLimits');
      if (service === 'STILL_OPEN') return t('nightly');
      return check.nextRunAt
        ? t('next', {
            when: format.dateTime(new Date(check.nextRunAt), {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
          })
        : t('idle');
    }
    if (state === 'OK') return t(service === 'GMAIL' ? 'setUp' : 'running');
    if (service === 'DATABASE') return t('dbDown');
    if (service === 'PDF_MAKER') return t(state === 'OFF' ? 'pdfOff' : 'pdfDown');
    if (service === 'RESUME_MATCHER') return t(state === 'OFF' ? 'rmOff' : 'rmDown');
    return t('gmailOff');
  };
}

function HealthRow({ check }: { check: HealthCheck }) {
  const t = useTranslations('Admin.overview');
  const text = useHealthText();
  const mark = MARK[check.state];
  return (
    <li className="flex flex-wrap items-start gap-x-2.5 gap-y-0.5 border-t border-slate-100 py-2.5 text-sm first:border-t-0 sm:flex-nowrap">
      <span
        role="img"
        aria-label={t(`mark.${check.state}`)}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${mark.color}`}
      >
        {mark.sign}
      </span>
      <span className="min-w-0 flex-1 font-semibold text-slate-900 sm:w-36 sm:flex-none sm:shrink-0">
        {t(`service.${check.service}`)}
      </span>
      {/* .env names are long words: let them break on a phone. */}
      <span className="w-full min-w-0 pl-7.5 break-words text-slate-700 sm:w-auto sm:flex-1 sm:pl-0">
        {text(check)}
      </span>
    </li>
  );
}

/** Imports per day as bars, today on the right. A hidden table reads the same numbers out. */
function Week({ week }: { week: AdminOverview['week'] }) {
  const t = useTranslations('Admin.overview');
  const format = useFormatter();
  const top = Math.max(1, ...week.map((d) => d.imports));
  const dayName = (iso: string) => format.dateTime(new Date(iso), { weekday: 'short' });
  return (
    <section
      aria-labelledby="week-heading"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 id="week-heading" className="text-base font-semibold text-slate-900">
        {t('weekHeading')}
      </h2>
      <div aria-hidden="true" className="mt-3">
        <div className="flex h-36 items-end gap-2 border-b border-slate-200 px-1">
          {week.map((d) => (
            <div
              key={d.day}
              title={`${dayName(d.day)}: ${String(d.imports)}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-[11px] text-slate-700 tabular-nums">{d.imports}</span>
              <div
                className="w-full max-w-10 rounded-t bg-slate-900"
                style={{
                  height: `${String(Math.round((d.imports / top) * 100))}%`,
                  minHeight: d.imports ? 2 : 0,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 px-1 pt-1 text-[11px] text-slate-600">
          {week.map((d) => (
            <span key={d.day} className="flex-1 text-center">
              {dayName(d.day)}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{t('weekNote')}</caption>
        <tbody>
          {week.map((d) => (
            <tr key={d.day}>
              <th scope="row">{dayName(d.day)}</th>
              <td>{d.imports}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-600">{t('weekNote')}</p>
    </section>
  );
}
