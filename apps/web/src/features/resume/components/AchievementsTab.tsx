import { zodResolver } from '@hookform/resolvers/zod';
import type { Profile } from '@jobsearch/data';
import { useMyProfile, useUpdateProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AutoHide } from '../../../components/AutoHide';
import { useErrorText } from '../../../i18n/useErrorText';
import { Field, inputClass } from '../../profile/components/Field';
import type { ProfileFormValues } from '../../profile/schema';
import { profileSchema, profileToForm, toProfileInput } from '../../profile/schema';

/**
 * The Achievements bank tab: one true fact per line, with real numbers. The AI may use them in
 * a tailored resume, the fact check trusts them, and Job match offers them as bullets.
 */
export function AchievementsTab() {
  const errorText = useErrorText();
  const t = useTranslations('Resume.files');
  const profile = useMyProfile();
  if (profile.isPending) return <p className="text-sm text-slate-500">{t('loading')}</p>;
  if (profile.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(profile.error)}
      </p>
    );
  }
  return <BankForm profile={profile.data} />;
}

function BankForm({ profile }: { profile: Profile }) {
  const errorText = useErrorText();
  const t = useTranslations('Profile');
  const tFiles = useTranslations('Resume.files');
  const tError = useTranslations('Profile.errors');
  const schema = useMemo(
    () => profileSchema((key, values) => tError(key as 'date', values as never)),
    [tError],
  );
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: profileToForm(profile),
  });
  // The rest of the profile goes along unchanged: the save sends the whole saved profile.
  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    const result = await update.mutateAsync(toProfileInput(values)).catch(() => null);
    if (result) {
      setSaved(true);
      reset(profileToForm(result));
    }
  });
  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e);
      }}
      onChange={() => {
        setSaved(false);
      }}
      noValidate
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <div>
        <h2 id="achievements-heading" className="text-lg font-semibold text-slate-900">
          {t('resume.achievements')}
        </h2>
        <p className="text-sm text-slate-600">{tFiles('achievementsIntro')}</p>
      </div>
      <Field
        label={t('resume.achievements')}
        htmlFor="achievements"
        error={errors.achievements?.message}
        hint={t('resume.achievementsHint')}
      >
        <textarea
          {...register('achievements')}
          id="achievements"
          aria-invalid={errors.achievements ? true : undefined}
          aria-describedby={errors.achievements ? 'achievements-error' : undefined}
          rows={12}
          placeholder={t('resume.achievementsExample')}
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? t('saving') : tFiles('saveBank')}
        </button>
        {saved && !isDirty && (
          <AutoHide key={update.submittedAt}>
            <p role="status" className="text-sm text-emerald-700">
              {tFiles('bankSaved')}
            </p>
          </AutoHide>
        )}
        {update.isError && (
          <p role="alert" className="text-sm text-red-700">
            {tFiles('saveFailed', { error: errorText(update.error) })}
          </p>
        )}
      </div>
    </form>
  );
}
