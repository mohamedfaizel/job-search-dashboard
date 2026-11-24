import type { Profile } from '@jobsearch/data';
import { useSetBriefing } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

/**
 * Settings › Notifications › Morning briefing: one summary a day, in the 🔔 and as a push on
 * your phone, at the time you pick.
 */
export function BriefingSettings({ profile }: { profile: Profile }) {
  const t = useTranslations('Settings.briefing');
  const errorText = useErrorText();
  const save = useSetBriefing();
  const [on, setOn] = useState(profile.briefingOn);
  const [at, setAt] = useState(profile.briefingAt);
  const changed = on !== profile.briefingOn || at !== profile.briefingAt;

  return (
    <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-800">{t('heading')}</legend>
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input
          id="briefing-on"
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
        <label htmlFor="briefing-at" className="text-sm text-slate-800">
          {t('at')}
        </label>
        <input
          id="briefing-at"
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
        {changed && (
          <button
            type="button"
            disabled={save.isPending || at === ''}
            onClick={() => {
              save.mutate({ on, at });
            }}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {t('save')}
          </button>
        )}
        {save.isSuccess && (
          <p role="status" className="text-sm text-emerald-700">
            {t('saved')}
          </p>
        )}
      </div>
      <p className="text-xs text-slate-600">{t('phoneHint')}</p>
      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(save.error)}
        </p>
      )}
    </fieldset>
  );
}
