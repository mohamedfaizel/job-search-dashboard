import type { Profile } from '@jobsearch/data';
import { useMyProfile, useUpdateNotificationSettings } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { closestFitOption, MATCH_FIT_OPTIONS } from '../../profile/schema';

/** Settings > Notifications: when the 🔔 tells you about new jobs. */
export function NotificationSettings() {
  const errorText = useErrorText();
  const t = useTranslations('Settings.notify');
  const profile = useMyProfile();

  return (
    <section
      aria-labelledby="notify-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="notify-heading" className="text-lg font-semibold text-slate-900">
        {t('heading')}
      </h2>
      {profile.isPending ? (
        <p className="text-sm text-slate-600">…</p>
      ) : profile.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {errorText(profile.error)}
        </p>
      ) : (
        <NotificationForm profile={profile.data} />
      )}
    </section>
  );
}

/** Starts from the saved values, so it waits until the profile has loaded. */
function NotificationForm({ profile }: { profile: Profile }) {
  const errorText = useErrorText();
  const t = useTranslations('Settings.notify');
  const save = useUpdateNotificationSettings();
  const [notify, setNotify] = useState(profile.notifyNewMatches);
  const [fitMin, setFitMin] = useState<string>(closestFitOption(profile.matchFitMin));

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ notifyNewMatches: notify, matchFitMin: Number(fitMin) });
      }}
    >
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={notify}
          onChange={(event) => {
            setNotify(event.target.checked);
            save.reset();
          }}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>
          {t('newMatches')}
          <span className="block text-xs text-slate-600">{t('newMatchesHint')}</span>
        </span>
      </label>
      <div className="space-y-1">
        <label htmlFor="matchFitMin" className="block text-sm font-medium text-slate-800">
          {t('fitMin')}
        </label>
        <select
          id="matchFitMin"
          value={fitMin}
          disabled={!notify}
          aria-describedby="matchFitMin-hint"
          onChange={(event) => {
            setFitMin(event.target.value);
            save.reset();
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-60"
        >
          {MATCH_FIT_OPTIONS.map((fit) => (
            <option key={fit} value={fit}>
              {t('fitOption', { fit: Number(fit) })}
            </option>
          ))}
        </select>
        <p id="matchFitMin-hint" className="text-xs text-slate-600">
          {t('fitMinHint')}
        </p>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="font-medium text-slate-800">{t('interview')}</p>
        <p className="text-xs text-slate-600">{t('interviewHint')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {save.isPending ? t('saving') : t('save')}
        </button>
        {save.isSuccess && (
          <p role="status" className="text-sm text-emerald-700">
            {t('saved')}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="text-sm text-red-700">
            {t('saveFailed', { error: errorText(save.error) })}
          </p>
        )}
      </div>
    </form>
  );
}
