'use client';

import { useTranslations } from 'next-intl';

export interface Step<Id extends string> {
  id: Id;
  label: string;
}

const PILL =
  'flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm whitespace-nowrap';

/**
 * The numbered steps of the Resume page (Content › Look › Download). Steps before the one you
 * are on show a ✓. You can jump to any step; on phones it folds into "Step 2 of 3" with arrows.
 */
export function StepBar<Id extends string>({
  steps,
  current,
  onSelect,
  isDone,
}: {
  steps: Step<Id>[];
  current: Id;
  onSelect: (id: Id) => void;
  /** Which steps get a ✓. Left out, every step before the current one does. */
  isDone?: (id: Id) => boolean;
}) {
  const t = useTranslations('Resume.steps');
  const index = steps.findIndex((step) => step.id === current);
  const here = steps[index];
  const go = (to: number) => {
    const step = steps[to];
    if (step) onSelect(step.id);
  };
  return (
    <nav aria-label={t('label')}>
      <ol className="hidden flex-wrap items-center gap-1.5 md:flex">
        {steps.map((step, i) => {
          const on = i === index;
          const done = !on && (isDone ? isDone(step.id) : i < index);
          return (
            <li key={step.id} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-slate-400">
                  ›
                </span>
              )}
              <button
                type="button"
                aria-current={on ? 'step' : undefined}
                onClick={() => {
                  onSelect(step.id);
                }}
                className={`${PILL} ${
                  on
                    ? 'border-brand-400 bg-brand-400 font-semibold text-black'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    on
                      ? 'bg-black text-brand-400'
                      : done
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200 md:hidden">
        <button
          type="button"
          aria-label={t('back')}
          disabled={index <= 0}
          onClick={() => {
            go(index - 1);
          }}
          className="h-9 w-9 rounded-md text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-slate-900">
          {t('of', { n: index + 1, total: steps.length, step: here?.label ?? '' })}
        </p>
        <button
          type="button"
          aria-label={t('forward')}
          disabled={index >= steps.length - 1}
          onClick={() => {
            go(index + 1);
          }}
          className="h-9 w-9 rounded-md text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </nav>
  );
}

/** "‹ Back" and the gold "Next: Look ›" under a step. */
export function StepNav<Id extends string>({
  steps,
  current,
  onSelect,
}: {
  steps: Step<Id>[];
  current: Id;
  onSelect: (id: Id) => void;
}) {
  const t = useTranslations('Resume.steps');
  const index = steps.findIndex((step) => step.id === current);
  const before = steps[index - 1];
  const after = steps[index + 1];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
      {before ? (
        <button
          type="button"
          onClick={() => {
            onSelect(before.id);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ‹ {before.label}
        </button>
      ) : (
        <span />
      )}
      {after && (
        <button
          type="button"
          onClick={() => {
            onSelect(after.id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="rounded-md bg-brand-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-brand-300"
        >
          {t('next', { step: after.label })} ›
        </button>
      )}
    </div>
  );
}
