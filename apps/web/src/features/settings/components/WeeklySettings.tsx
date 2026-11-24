import type { Profile } from '@jobsearch/data';
import { useSetWeeklyReport } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

/**
 * Settings › Notifications › Weekly report: on Sunday evening, your week in the 🔔 and as a push
 * on your phone. It saves as soon as you tick or untick it.
 */
export function WeeklySettings({ profile }: { profile: Profile }) {
  const t = useTranslations('Settings.weekly');
  const errorText = useErrorText();
  const save = useSetWeeklyReport();
  const [on, setOn] = useState(profile.weeklyReport);

  return (
    <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-800">{t('heading')}</legend>
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input
          id="weekly-on"
          type="checkbox"
          checked={on}
          disabled={save.isPending}
          onChange={(event) => {
            setOn(event.target.checked);
            save.mutate(event.target.checked);
          }}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>
          {t('on')}
          <span className="block text-xs text-slate-600">{t('onHint')}</span>
        </span>
      </label>
      {save.isSuccess && (
        <p role="status" className="text-sm text-emerald-700">
          {t('saved')}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(save.error)}
        </p>
      )}
    </fieldset>
  );
}
