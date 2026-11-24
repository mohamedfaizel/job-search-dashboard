import type { Profile } from '@jobsearch/data';
import { useMyProfile, useSetNightlyKits, useWriteKitsNow } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

const PER_NIGHT = [1, 3, 5, 10, 20] as const;

/**
 * Settings › API keys › Nightly apply kits: at night the app writes the resume, cover letter and
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
  const [on, setOn] = useState(profile.nightlyKits);
  const [perNight, setPerNight] = useState(profile.nightlyKitsMax);
  const changed = on !== profile.nightlyKits || perNight !== profile.nightlyKitsMax;

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
      <div className="flex flex-wrap items-center gap-3">
        {changed && (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              save.mutate({ on, perNight });
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {t('save')}
          </button>
        )}
        <button
          type="button"
          disabled={now.isPending}
          onClick={() => {
            now.mutate();
          }}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {t('writeNow')}
        </button>
        {save.isSuccess && (
          <p role="status" className="text-sm text-emerald-700">
            {t('saved')}
          </p>
        )}
      </div>
      {now.isSuccess && (
        <p role="status" className="text-sm text-emerald-700">
          {t('started', { count: now.data })}
        </p>
      )}
      {(save.error ?? now.error) && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(save.error ?? now.error)}
        </p>
      )}
    </div>
  );
}
