import type { Profile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useErrorText } from '../../../i18n/useErrorText';
import { Field, inputClass } from '../../profile/components/Field';
import { SaveBar, useProfileSection, WithProfile } from './profileSection';

/**
 * The Achievements bank tab: one true fact per line, with real numbers. The AI may use them in
 * a tailored resume, the fact check trusts them, and Job match offers them as bullets.
 */
export function AchievementsTab() {
  return <WithProfile>{(profile) => <BankForm profile={profile} />}</WithProfile>;
}

function BankForm({ profile }: { profile: Profile }) {
  const errorText = useErrorText();
  const t = useTranslations('Profile');
  const tFiles = useTranslations('Resume.files');
  const { form, update, saved, setSaved, onSubmit } = useProfileSection(profile);
  const {
    register,
    formState: { errors, isSubmitting, isDirty },
  } = form;
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
      <SaveBar
        label={tFiles('saveBank')}
        savedText={tFiles('bankSaved')}
        busy={isSubmitting}
        showSaved={saved && !isDirty}
        submittedAt={update.submittedAt}
        error={update.isError ? tFiles('saveFailed', { error: errorText(update.error) }) : null}
      />
    </form>
  );
}
