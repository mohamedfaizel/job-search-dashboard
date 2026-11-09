'use client';

import type { Funnel } from '@jobsearch/data';
import { useFunnel } from '@jobsearch/data';
import { useTranslations } from 'next-intl';

const percent = (value: number | null) =>
  value === null ? '–' : `${String(Math.round(value * 100))}%`;

/** The four steps, as bars: how many jobs got this far, and the share of the step before. */
function FunnelBars({ funnel }: { funnel: Funnel }) {
  const t = useTranslations('Tracker.funnel');
  const steps = [
    { id: 'tracked', count: funnel.tracked, color: 'bg-slate-400' },
    { id: 'applied', count: funnel.applied, color: 'bg-slate-700' },
    { id: 'interviews', count: funnel.interviews, color: 'bg-amber-400' },
    { id: 'offers', count: funnel.offers, color: 'bg-emerald-600' },
  ] as const;
  const top = Math.max(funnel.tracked, 1);
  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => {
        const before = index > 0 ? (steps[index - 1]?.count ?? 0) : null;
        return (
          <li key={step.id} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-sm">
            <span className="text-slate-700">{t(`steps.${step.id}`)}</span>
            <span className="h-5 overflow-hidden rounded bg-slate-100">
              <span
                className={`block h-full rounded ${step.color}`}
                style={{ width: `${String((step.count / top) * 100)}%` }}
              />
            </span>
            <span className="min-w-20 text-right tabular-nums">
              <b className="text-slate-900">{step.count}</b>
              {before !== null && before > 0 && (
                <span className="ml-1 text-xs text-slate-500">
                  ({percent(step.count / before)})
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Your funnel at the top of the Tracker: how far your applications got, how many got an answer,
 * how long answers take, and which job sources bring interviews. It counts each status a job
 * moved through, so a rejection after an interview still counts as an interview.
 */
export function FunnelCard() {
  const t = useTranslations('Tracker.funnel');
  const funnel = useFunnel();
  if (!funnel.data || funnel.data.tracked === 0) return null;
  const f = funnel.data;
  const stats = [
    { id: 'answered', value: percent(f.responseRate) },
    {
      id: 'wait',
      value:
        f.medianDaysToReply === null ? '–' : t('days', { count: Math.round(f.medianDaysToReply) }),
    },
    { id: 'waiting', value: String(f.waiting) },
    { id: 'week', value: String(f.appliedLast7Days) },
    { id: 'month', value: String(f.appliedLast30Days) },
  ] as const;
  const sources = f.bySource.filter((s) => s.applied > 0);

  return (
    <details open className="group rounded-lg border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
        <span aria-hidden className="mr-1 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {t('title')}
        <span className="ml-2 font-normal text-slate-500">
          {t('summary', { applied: f.applied, interviews: f.interviews, offers: f.offers })}
        </span>
      </summary>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto]">
        <FunnelBars funnel={f} />
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5 md:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.id} className="rounded-md bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">{t(`stats.${stat.id}`)}</dt>
              <dd className="text-base font-semibold tabular-nums text-slate-900">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {sources.length > 1 && (
        <table className="mt-4 w-full max-w-lg text-sm">
          <caption className="mb-1 text-left text-xs font-medium text-slate-500">
            {t('bySource')}
          </caption>
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="font-medium">{t('source')}</th>
              <th className="text-right font-medium">{t('steps.applied')}</th>
              <th className="text-right font-medium">{t('steps.interviews')}</th>
              <th className="text-right font-medium">{t('steps.offers')}</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source} className="border-t border-slate-100">
                <td className="py-1">{t(`sources.${s.source}`)}</td>
                <td className="text-right tabular-nums">{s.applied}</td>
                <td className="text-right tabular-nums">{s.interviews}</td>
                <td className="text-right tabular-nums">{s.offers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-slate-500">{t('hint')}</p>
    </details>
  );
}
