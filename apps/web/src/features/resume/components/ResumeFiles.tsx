import type { Profile } from '@jobsearch/data';
import { RESUME_LANGUAGES } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { Field } from '../../profile/components/Field';
import { useLanguageName } from '../../profile/components/useLanguageName';
import type { ProfileFormValues } from '../../profile/schema';
import { profileToForm, toProfileInput } from '../../profile/schema';
import { OtherResumes } from './OtherResumes';
import { SaveBar, useProfileSection, WithProfile } from './profileSection';
import { ResumeSuggestions } from './ResumeSuggestions';
import { ResumeUpload } from './ResumeUpload';

const card = 'space-y-4 rounded-lg border border-slate-200 bg-white p-5';

/**
 * The Files tab of the Resume page: the file your resume comes from, its language, your
 * achievements bank, the page limit and your resumes in other languages. They used to be on
 * My profile > Resume; each setting lives in one place only.
 */
export function ResumeFiles() {
  return <WithProfile>{(profile) => <FilesForm profile={profile} />}</WithProfile>;
}

function FilesForm({ profile }: { profile: Profile }) {
  const errorText = useErrorText();
  const t = useTranslations('Profile');
  const tFiles = useTranslations('Resume.files');
  const languageName = useLanguageName();
  const { form, update, saved, setSaved, onSubmit } = useProfileSection(profile);
  const [copiedToBank, setCopiedToBank] = useState(false);
  const {
    register,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const a11y = (name: keyof ProfileFormValues) => ({
    id: name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        onChange={() => {
          setSaved(false);
        }}
        noValidate
        className="space-y-6"
      >
        <section aria-labelledby="resume-heading" className={card}>
          <div>
            <h2 id="resume-heading" className="text-lg font-semibold text-slate-900">
              {t('resume.heading')}
            </h2>
            <p className="text-sm text-slate-600">{t('resume.intro')}</p>
          </div>
          <ResumeUpload fileName={profile.resumeFileName} />
          <ResumeSuggestions
            suggestions={profile.resumeSuggestions}
            reviewPrompt={profile.resumeReviewPrompt}
            onUseAchievements={(lines) => {
              // The bank has its own tab: the lines are saved there straight away.
              setSaved(false);
              setCopiedToBank(false);
              update.mutate(
                { ...toProfileInput(profileToForm(profile)), achievements: lines },
                {
                  onSuccess: () => {
                    setCopiedToBank(true);
                  },
                },
              );
            }}
          />
          <Field
            label={t('resume.language')}
            htmlFor="resumeLanguage"
            hint={t('resume.languageHint')}
          >
            <select
              {...register('resumeLanguage')}
              {...a11y('resumeLanguage')}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              {Object.keys(RESUME_LANGUAGES).map((code) => (
                <option key={code} value={code}>
                  {languageName(code)}
                </option>
              ))}
            </select>
          </Field>
          {copiedToBank && (
            <p role="status" className="text-sm text-emerald-700">
              {tFiles('copiedToBank')}
            </p>
          )}
          <fieldset className="space-y-3 rounded-md border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-900">
              {t('resume.settings')}
            </legend>
            <Field
              label={t('resume.maxPages')}
              htmlFor="resumeMaxPages"
              hint={t('resume.maxPagesHint')}
            >
              <select
                {...register('resumeMaxPages')}
                {...a11y('resumeMaxPages')}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                {(['1', '2', '3'] as const).map((n) => (
                  <option key={n} value={n}>
                    {t('resume.pages', { count: Number(n) })}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                {...register('keepMySections')}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                {t('resume.keepSections')}
                <span className="block text-xs text-slate-500">{t('resume.keepSectionsHint')}</span>
              </span>
            </label>
          </fieldset>
        </section>
        <SaveBar
          label={tFiles('save')}
          savedText={tFiles('saved')}
          busy={isSubmitting}
          showSaved={saved && !isDirty}
          submittedAt={update.submittedAt}
          error={update.isError ? tFiles('saveFailed', { error: errorText(update.error) }) : null}
        />
      </form>
      <OtherResumes profile={profile} />
    </div>
  );
}
