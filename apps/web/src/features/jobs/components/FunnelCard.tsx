'use client';

import type { Funnel } from '@jobsearch/data';
import { useFunnel } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useDismiss } from '@/lib/use-dismiss';

const percent = (value: number | null) =>
  value === null ? '–' : `${String(Math.round(value * 100))}%`;

/** The four steps in one row, each with the share of the step before: 25 › 20 (80%) › 0 › 0. */
function FunnelSteps({ funnel }: { funnel: Funnel }) {
  const t = useTranslations('Tracker.funnel');
  const steps = [
    { id: 'tracked', count: funnel.tracked, dot: 'bg-slate-400' },
    { id: 'applied', count: funnel.applied, dot: 'bg-slate-700' },
    { id: 'interviews', count: funnel.interviews, dot: 'bg-amber-400' },
    { id: 'offers', count: funnel.offers, dot: 'bg-emerald-600' },
  ] as const;
  return (
    <ol className="flex flex-wrap items-center gap-1 text-sm">
      {steps.map((step, index) => {
        const before = index > 0 ? (steps[index - 1]?.count ?? 0) : null;
        return (
          <li key={step.id} className="flex items-center gap-1">
            {index > 0 && (
              <span aria-hidden="true" className="px-0.5 text-slate-300">
                ›
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[13px]">
              <span aria-hidden="true" className={`size-2 rounded-full ${step.dot}`} />
              <span className="text-slate-600">{t(`steps.${step.id}`)}</span>
              <b className="tabular-nums text-slate-900">{step.count}</b>
              {before !== null && before > 0 && (
                <span className="text-xs tabular-nums text-slate-500">
                  {percent(step.count / before)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A <details> that also closes on Escape or a click outside, like the app's other pop-ups. */
function MorePanel({ label, children }: { label: string; children: ReactNode }) {
  const box = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    if (box.current) box.current.open = false;
    setOpen(false);
    box.current?.querySelector('summary')?.focus();
  }, []);
  useDismiss(open, box, close);
  return (
    <details
      ref={box}
      className="group text-sm"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary className="cursor-pointer list-none text-xs font-medium text-slate-500 underline hover:text-slate-700">
        {label}
      </summary>
      {children}
    </details>
  );
}

/**
 * Your funnel in the Tracker's title line: how far your applications got, how many got an answer,
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
    <section
      aria-label={t('title')}
      className="relative flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
    >
      <FunnelSteps funnel={f} />
      <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        {stats.slice(0, 2).map((stat) => (
          <div key={stat.id} className="flex items-baseline gap-1">
            <dt>{t(`stats.${stat.id}`)}</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {/* The rest opens in a small panel, so the header stays one line. */}
      <MorePanel label={t('more')}>
        <div className="absolute top-full right-0 left-0 z-20 mt-1 max-w-lg space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <dl className="flex flex-wrap gap-x-4 gap-y-1">
            {stats.slice(2).map((stat) => (
              <div key={stat.id} className="flex items-baseline gap-1.5">
                <dt className="text-xs text-slate-500">{t(`stats.${stat.id}`)}</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{stat.value}</dd>
              </div>
            ))}
          </dl>
          {sources.length > 1 && (
            <table className="w-full text-sm">
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
          <p className="text-xs text-slate-500">{t('hint')}</p>
        </div>
      </MorePanel>
    </section>
  );
}
