import type { KitRun, Profile } from '@jobsearch/data';
import { useKitRun, useMyProfile, useSetNightlyKits, useWriteKitsNow } from '@jobsearch/data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

const PER_NIGHT = [1, 3, 5, 10, 20] as const;
/** "Write kits for": the Apply queue only (empty), or also new jobs with at least this Fit %. */
const FIT_MINS = [60, 70, 75, 80, 90] as const;
const REASONS = ['NO_KEY', 'KEY_REFUSED', 'NO_RESUME', 'NONE_WRITTEN'] as const;
const reasonOf = (reason: string | null) =>
  REASONS.find((known) => known === reason) ?? 'NONE_WRITTEN';

/**
 * Settings › API keys › Nightly apply kits: at your time (03:00 by default) the app writes the resume, cover letter and
 * form answers of each queued job with your own AI key, so they are ready in the morning.
 */
export function NightlyKits() {
  const t = useTranslations('Settings.kits');
  const errorText = useErrorText();
  const profile = useMyProfile();

  return (
    <section
      aria-labelledby="kits-heading"
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="kits-heading" className="text-lg font-semibold text-slate-900">
        {t('heading')}
      </h2>
      <p className="text-sm text-slate-600">{t('intro')}</p>
      {profile.isPending ? (
        <p className="text-sm text-slate-600">…</p>
      ) : profile.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {errorText(profile.error)}
        </p>
      ) : (
        <KitsForm profile={profile.data} />
      )}
    </section>
  );
}

function KitsForm({ profile }: { profile: Profile }) {
  const t = useTranslations('Settings.kits');
  const errorText = useErrorText();
  const save = useSetNightlyKits();
  const now = useWriteKitsNow();
  const run = useKitRun();
  const running = now.isPending || (run.data?.running ?? false);
  const [on, setOn] = useState(profile.nightlyKits);
  const [perNight, setPerNight] = useState(profile.nightlyKitsMax);
  const [at, setAt] = useState(profile.nightlyKitsAt);
  const [fitMin, setFitMin] = useState(profile.nightlyKitsFitMin);
  const changed =
    on !== profile.nightlyKits ||
    perNight !== profile.nightlyKitsMax ||
    at !== profile.nightlyKitsAt ||
    fitMin !== profile.nightlyKitsFitMin;

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input
          id="kits-on"
          type="checkbox"
          checked={on}
          onChange={(event) => {
            setOn(event.target.checked);
            save.reset();
          }}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>
          {t('on')}
          <span className="block text-xs text-slate-600">{t('onHint')}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="kits-for" className="text-sm text-slate-800">
          {t('for')}
        </label>
        <select
          id="kits-for"
          value={fitMin ?? ''}
          disabled={!on}
          onChange={(event) => {
            setFitMin(event.target.value === '' ? null : Number(event.target.value));
            save.reset();
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-60"
        >
          <option value="">{t('forQueue')}</option>
          {FIT_MINS.map((n) => (
            <option key={n} value={n}>
              {t('forGood', { fit: n })}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-600">{t('forHint')}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="kits-per-night" className="text-sm text-slate-800">
          {t('perNight')}
        </label>
        <select
          id="kits-per-night"
          value={perNight}
          disabled={!on}
          onChange={(event) => {
            setPerNight(Number(event.target.value));
            save.reset();
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-60"
        >
          {PER_NIGHT.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-600">{t('cost')}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="kits-at" className="text-sm text-slate-800">
          {t('at')}
        </label>
        <input
          id="kits-at"
          type="time"
          required
          disabled={!on}
          value={at}
          onChange={(event) => {
            setAt(event.target.value);
            save.reset();
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-60"
        />
        <span className="text-xs text-slate-600">{t('atHint')}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {changed && (
          <button
            type="button"
            disabled={save.isPending || at === ''}
            onClick={() => {
              save.mutate({ on, perNight, at, fitMin });
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {t('save')}
          </button>
        )}
        <button
          type="button"
          disabled={running}
          onClick={() => {
            now.mutate();
          }}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {running ? t('writing') : t('writeNow')}
        </button>
        {save.isSuccess && (
          <p role="status" className="text-sm text-emerald-700">
            {t('saved')}
          </p>
        )}
      </div>
      {!now.isError && run.data && <RunResult run={run.data} />}
      {(save.error ?? now.error) && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(save.error ?? now.error)}
        </p>
      )}
    </div>
  );
}

/** What the latest run is doing, or what it did: always a line, never silence. */
function RunResult({ run }: { run: KitRun }) {
  const t = useTranslations('Settings.kits');
  if (run.running) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-slate-700">
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
        />
        {t('progress', { done: Math.min(run.done + 1, run.total), total: run.total })}
      </p>
    );
  }
  if (run.written === 0) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t(`reason.${reasonOf(run.reason)}`)}
      </p>
    );
  }
  return (
    <p role="status" className="text-sm text-emerald-700">
      {t('doneWritten', { count: run.written })}{' '}
      {run.failed > 0 && (
        <span className="text-amber-800">{t('doneFailed', { count: run.failed })} </span>
      )}
      <Link href="/jobs" className="font-medium text-brand-700 underline">
        {t('openQueue')}
      </Link>
    </p>
  );
}
