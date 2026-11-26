import type { AutopilotRules, SavedSearch } from '@jobsearch/data';
import { useKitRun, useMyApiKeys, useSetAutopilot } from '@jobsearch/data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

const rulesOf = (search: SavedSearch): AutopilotRules => ({
  autopilot: search.autopilot,
  autoQueueFitMin: search.autoQueueFitMin,
  autoQueueNeedsVisa: search.autoQueueNeedsVisa,
  autoHideFitBelow: search.autoHideFitBelow,
  autoQueueMaxPerDay: search.autoQueueMaxPerDay,
  autoKits: search.autoKits,
  kitScoreTarget: search.kitScoreTarget,
});

const same = (a: AutopilotRules, b: AutopilotRules) =>
  (Object.keys(a) as (keyof AutopilotRules)[]).every((key) => a[key] === b[key]);

/** A small number box: whole numbers from `min` to `max`. Out of range goes back on blur. */
function NumberBox({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-xs text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        onChange={(event) => {
          // Half-typed numbers stay in the box; only a whole number in range is used.
          setText(event.target.value);
          const next = Number(event.target.value);
          if (event.target.value !== '' && Number.isInteger(next) && next >= min && next <= max) {
            onChange(next);
          }
        }}
        onBlur={() => {
          setText(String(value));
        }}
        className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 tabular-nums"
      />
      {suffix && <span className="text-xs text-slate-600">{suffix}</span>}
    </div>
  );
}

/**
 * Autopilot rules for one saved search: after each run, jobs that fit well go to your Apply queue
 * and poor, closed or duplicate ones are hidden. The 🔔 says what it did, with Undo. With "Write
 * apply kits" on, the queued jobs' kits are written next with your own AI key.
 */
export function AutopilotControls({ search }: { search: SavedSearch }) {
  const t = useTranslations('AddJobs.saved');
  const errorText = useErrorText();
  const save = useSetAutopilot();
  const [rules, setRules] = useState<AutopilotRules>(() => rulesOf(search));
  const changed = !same(rules, rulesOf(search));
  const id = `autopilot-${search.id}`;
  const set = (patch: Partial<AutopilotRules>) => {
    setRules((was) => ({ ...was, ...patch }));
  };

  return (
    <fieldset className="space-y-2 rounded-md bg-slate-50 p-3">
      <legend className="sr-only">{t('autopilotFor', { name: search.name })}</legend>
      <div className="flex items-center gap-2">
        <button
          id={`${id}-on`}
          type="button"
          role="switch"
          aria-checked={rules.autopilot}
          aria-labelledby={`${id}-label`}
          onClick={() => {
            set({ autopilot: !rules.autopilot });
          }}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            rules.autopilot ? 'bg-amber-400' : 'bg-slate-300'
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-neutral-900 transition-all ${
              rules.autopilot ? 'left-[1.15rem]' : 'left-0.5'
            }`}
          />
        </button>
        <span id={`${id}-label`} className="text-sm font-semibold text-slate-900">
          {t('autopilot')}
        </span>
      </div>
      <p className="text-xs text-slate-600">{t('autopilotHint')}</p>
      {rules.autopilot && (
        <div className="space-y-2">
          <NumberBox
            id={`${id}-queue`}
            label={t('queueAt')}
            value={rules.autoQueueFitMin}
            min={1}
            max={100}
            suffix="%"
            onChange={(autoQueueFitMin) => {
              set({ autoQueueFitMin });
            }}
          />
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              id={`${id}-visa`}
              type="checkbox"
              checked={rules.autoQueueNeedsVisa}
              onChange={(event) => {
                set({ autoQueueNeedsVisa: event.target.checked });
              }}
            />
            {t('needsVisa')}
          </label>
          <NumberBox
            id={`${id}-hide`}
            label={t('hideBelow')}
            value={rules.autoHideFitBelow}
            min={0}
            max={99}
            suffix="%"
            onChange={(autoHideFitBelow) => {
              set({ autoHideFitBelow });
            }}
          />
          <p className="text-xs text-slate-600">{t('hideBelowHint')}</p>
          <NumberBox
            id={`${id}-max`}
            label={t('maxPerDay')}
            value={rules.autoQueueMaxPerDay}
            min={1}
            max={50}
            onChange={(autoQueueMaxPerDay) => {
              set({ autoQueueMaxPerDay });
            }}
          />
          <KitsControls id={id} rules={rules} set={set} />
        </div>
      )}
      {changed && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            aria-label={t('saveAutopilot')}
            title={t('saveAutopilot')}
            disabled={save.isPending}
            onClick={() => {
              save.mutate({ id: search.id, ...rules });
            }}
            className="grid h-8 w-8 place-items-center rounded-full bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            <span aria-hidden>✓</span>
          </button>
          <button
            type="button"
            aria-label={t('cancelAutopilot')}
            title={t('cancelAutopilot')}
            onClick={() => {
              setRules(rulesOf(search));
              save.reset();
            }}
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 bg-white text-red-700 hover:bg-slate-50"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
      )}
      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t('autopilotError', { error: errorText(save.error) })}
        </p>
      )}
    </fieldset>
  );
}

/**
 * "Write apply kits" inside Autopilot: the jobs it queues get their kit (resume, cover letter, form
 * answers) right after the run, written with your own AI key, aiming at the target score. Its
 * Fit % and daily limit are Autopilot's own, so there is nothing else to set.
 */
function KitsControls({
  id,
  rules,
  set,
}: {
  id: string;
  rules: AutopilotRules;
  set: (patch: Partial<AutopilotRules>) => void;
}) {
  const t = useTranslations('AddJobs.saved');
  const keys = useMyApiKeys();
  const run = useKitRun();
  const hasKey = (keys.data ?? []).some((k) => k.kind === 'ANTHROPIC' || k.kind === 'OPENAI');
  // Until the keys are loaded, don't grey it out.
  const noKey = keys.isSuccess && !hasKey;
  const writing = run.data?.running ? run.data : null;

  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2.5">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <input
          id={`${id}-kits`}
          type="checkbox"
          checked={rules.autoKits && !noKey}
          disabled={noKey}
          onChange={(event) => {
            set({ autoKits: event.target.checked });
          }}
        />
        <span className={noKey ? 'text-slate-500' : undefined}>{t('kitsOn')}</span>
      </label>
      {noKey ? (
        <p role="alert" className="text-xs text-red-700">
          {t('kitsNoKey')}{' '}
          <Link href="/settings?tab=keys" className="font-medium underline">
            {t('kitsAddKey')}
          </Link>
        </p>
      ) : (
        <p className="text-xs text-slate-600">{t('kitsHint', { max: rules.autoQueueMaxPerDay })}</p>
      )}
      {rules.autoKits && !noKey && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${id}-target`} className="text-xs text-slate-700">
              {t('kitsTarget')}
            </label>
            <input
              id={`${id}-target`}
              type="range"
              min={70}
              max={95}
              step={5}
              value={rules.kitScoreTarget}
              onChange={(event) => {
                set({ kitScoreTarget: Number(event.target.value) });
              }}
              className="w-32 accent-slate-900"
            />
            <span aria-hidden className="text-sm font-semibold text-slate-900 tabular-nums">
              {rules.kitScoreTarget}%
            </span>
          </div>
          <p className="text-xs text-slate-600">{t('kitsTargetHint')}</p>
        </>
      )}
      {writing && (
        <p role="status" className="text-xs text-emerald-800">
          {t('kitsWriting', {
            done: Math.min(writing.done + 1, writing.total),
            total: writing.total,
          })}
        </p>
      )}
    </div>
  );
}
