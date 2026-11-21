import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ColumnFilter } from './ColumnFilter';

/** Quick picks under the Fit ≥ box. */
const FIT_PICKS = [50, 70, 90] as const;
/** The "Posted" choices, in days. */
const POSTED_WITHIN = [1, 3, 7, 30] as const;

/** The Scores column's ⏷: "Fit ≥ [70] %", to show only the jobs that match you well enough. */
export function FitFilter({
  column,
  minFit,
  onMinFit,
}: {
  column: string;
  minFit: number | null;
  onMinFit: (minFit: number | null) => void;
}) {
  const t = useTranslations('Jobs.filter');
  const [draft, setDraft] = useState(minFit === null ? '' : String(minFit));
  // Keep the box in step when the filter changes elsewhere (Clear all, a saved setting).
  const [last, setLast] = useState(minFit);
  if (minFit !== last) {
    setLast(minFit);
    setDraft(minFit === null ? '' : String(minFit));
  }
  const apply = (text: string) => {
    setDraft(text);
    const value = Number.parseInt(text, 10);
    onMinFit(Number.isNaN(value) ? null : Math.min(100, Math.max(0, value)));
  };

  return (
    <ColumnFilter
      column={column}
      onClear={() => {
        onMinFit(null);
      }}
      activeCount={minFit === null ? 0 : 1}
      panel={
        <div className="space-y-2 p-1">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            {t('fit')}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={5}
              aria-label={t('fitLabel')}
              value={draft}
              onChange={(e) => {
                apply(e.target.value);
              }}
              className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
            />
            %
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FIT_PICKS.map((fit) => (
              <button
                key={fit}
                type="button"
                aria-pressed={minFit === fit}
                onClick={() => {
                  apply(String(fit));
                }}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  minFit === fit
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                ≥ {fit}%
              </button>
            ))}
          </div>
          {minFit !== null && (
            <button
              type="button"
              onClick={() => {
                onMinFit(null);
              }}
              className="w-full rounded px-2 py-1 text-xs text-brand-700 hover:bg-brand-50"
            >
              {t('clear')}
            </button>
          )}
        </div>
      }
    />
  );
}

/** The Posted column's ⏷: any time, or the last day, 3 days, week or month. */
export function PostedFilter({
  column,
  postedWithinDays,
  onPostedWithin,
}: {
  column: string;
  postedWithinDays: number | null;
  onPostedWithin: (days: number | null) => void;
}) {
  const t = useTranslations('Jobs.filter');
  const choices: { days: number | null; label: string }[] = [
    { days: null, label: t('anyTime') },
    ...POSTED_WITHIN.map((days) => ({ days, label: t(`within.d${days}`) })),
  ];
  return (
    <ColumnFilter
      column={column}
      onClear={() => {
        onPostedWithin(null);
      }}
      activeCount={postedWithinDays === null ? 0 : 1}
      panel={
        <ul className="space-y-0.5">
          {choices.map(({ days, label }) => (
            <li key={label}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                <input
                  type="radio"
                  name="posted-within"
                  checked={postedWithinDays === days}
                  onChange={() => {
                    onPostedWithin(days);
                  }}
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
      }
    />
  );
}
