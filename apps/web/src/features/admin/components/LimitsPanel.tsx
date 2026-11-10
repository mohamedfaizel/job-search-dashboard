'use client';

import type { AppSettings, AppSettingsChange } from '@jobsearch/data';
import { useAppSettings, useUpdateAppSettings } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useErrorText } from '@/i18n/useErrorText';

const ROW =
  'flex flex-col gap-3 border-t border-slate-100 p-4 first:border-t-0 sm:flex-row sm:items-center sm:gap-5 sm:px-5';

/**
 * Admin › Limits: the daily credit limit for scheduled searches, the most saved searches per
 * user, and the two background jobs. Each change saves on its own and works at once.
 */
export function LimitsPanel() {
  const t = useTranslations('Admin.limits');
  const errorText = useErrorText();
  const settings = useAppSettings();
  const update = useUpdateAppSettings();

  if (settings.isPending) return <p className="text-sm text-slate-600">{t('loading')}</p>;
  if (settings.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(settings.error)}
      </p>
    );
  }
  const s = settings.data;
  const save = (change: AppSettingsChange) => {
    update.mutate(change);
  };

  return (
    <div className="max-w-3xl space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white">
        <NumberRow
          label={t('cap')}
          hint={t('capHint')}
          value={s.dailyCreditCap}
          min={0}
          max={100_000}
          onSave={(dailyCreditCap) => {
            save({ dailyCreditCap });
          }}
        />
        <NumberRow
          label={t('max')}
          hint={t('maxHint')}
          value={s.maxSavedSearches}
          min={1}
          max={1000}
          onSave={(maxSavedSearches) => {
            save({ maxSavedSearches });
          }}
        />
        <SwitchRow
          label={t('scheduler')}
          hint={t('schedulerHint')}
          settings={s}
          field="schedulerOn"
          offInEnv={s.schedulerOffInEnv}
          busy={update.isPending}
          onSave={save}
        />
        <SwitchRow
          label={t('stillOpen')}
          hint={t('stillOpenHint')}
          settings={s}
          field="stillOpenOn"
          offInEnv={s.stillOpenOffInEnv}
          busy={update.isPending}
          onSave={save}
        />
      </section>
      <p aria-live="polite" className="text-xs text-slate-600">
        {update.isError ? (
          <span className="text-red-700">{errorText(update.error)}</span>
        ) : update.isSuccess ? (
          t('saved')
        ) : (
          t('note')
        )}
      </p>
    </div>
  );
}

/** A number that saves when you leave the box (or press Enter), if it is a valid new value. */
function NumberRow({
  label,
  hint,
  value,
  min,
  max,
  onSave,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onSave: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const next = Number(draft);
    if (draft.trim() === '' || !Number.isInteger(next) || next < min || next > max) {
      setDraft(String(value));
      return;
    }
    if (next !== value) onSave(next);
  };
  return (
    <div className={ROW}>
      <div className="flex-1 space-y-0.5">
        <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-xs text-slate-600">
          {hint}
        </p>
      </div>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-right text-sm sm:w-28"
      />
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  settings,
  field,
  offInEnv,
  busy,
  onSave,
}: {
  label: string;
  hint: string;
  settings: AppSettings;
  field: 'schedulerOn' | 'stillOpenOn';
  offInEnv: boolean;
  busy: boolean;
  onSave: (change: AppSettingsChange) => void;
}) {
  const t = useTranslations('Admin.limits');
  const id = useId();
  // .env wins: the switch shows off and can't be turned on here.
  const on = settings[field] && !offInEnv;
  return (
    <div className={ROW}>
      <div className="flex-1 space-y-0.5">
        <span id={id} className="block text-sm font-semibold text-slate-900">
          {label}
        </span>
        <p id={`${id}-hint`} className="text-xs text-slate-600">
          {offInEnv ? t('offInEnv') : hint}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        aria-describedby={`${id}-hint`}
        disabled={busy || offInEnv}
        onClick={() => {
          onSave({ [field]: !settings[field] });
        }}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          on ? 'bg-slate-900' : 'bg-slate-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 h-6 w-6 rounded-full transition-all ${
            on ? 'right-1 bg-brand-400' : 'left-1 bg-white'
          }`}
        />
      </button>
    </div>
  );
}
