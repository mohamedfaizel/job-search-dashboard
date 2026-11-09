import type { Profile } from '@jobsearch/data';
import { RESUME_LANGUAGES } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { InfoTip } from '../../../components/InfoTip';
import { useErrorText } from '../../../i18n/useErrorText';
import { useLanguageName } from '../../profile/components/useLanguageName';
import type { ProfileFormValues } from '../../profile/schema';
import { profileToForm, toProfileInput } from '../../profile/schema';
import { OtherResumes } from './OtherResumes';
import { SaveBar, useProfileSection, WithProfile } from './profileSection';
import { ResumeSuggestions } from './ResumeSuggestions';
import { ResumeUpload } from './ResumeUpload';

const card = 'space-y-2.5 border-b border-slate-200 pb-4';
const SELECT = 'rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm';
const LABEL = 'text-sm font-medium text-slate-700';

/**
 * The Setup panel of the Resume page, one short list for the panel on the right: this resume's
 * language, file and suggestions, the settings shared by all your resumes (page limit, keep my
 * headings) and your resumes in other languages. A change saves by itself; explanations sit
 * behind ⓘ.
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
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        onChange={(e) => {
          setSaved(false);
          // A list or a tick saves at once; the file upload saves on its own.
          const field = e.target;
          if (
            field instanceof HTMLSelectElement ||
            (field instanceof HTMLInputElement && field.type === 'checkbox')
          ) {
            e.currentTarget.requestSubmit();
          }
        }}
        noValidate
        className="space-y-4"
      >
        <section aria-labelledby="resume-heading" className={card}>
          <div className="flex items-center gap-2">
            <h2 id="resume-heading" className="font-semibold text-slate-900">
              {t('resume.heading')}
            </h2>
            <InfoTip
              label={t('moreAbout', { field: t('resume.heading') })}
              text={t('resume.intro')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="resumeLanguage" className={LABEL}>
              {t('resume.language')}
            </label>
            <InfoTip
              label={t('moreAbout', { field: t('resume.language') })}
              text={t('resume.languageHint')}
            />
            <select {...register('resumeLanguage')} {...a11y('resumeLanguage')} className={SELECT}>
              {Object.keys(RESUME_LANGUAGES).map((code) => (
                <option key={code} value={code}>
                  {languageName(code)}
                </option>
              ))}
            </select>
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
          {copiedToBank && (
            <p role="status" className="text-sm text-emerald-700">
              {tFiles('copiedToBank')}
            </p>
          )}
        </section>
        <section aria-label={t('resume.settings')} className={card}>
          <fieldset className="space-y-2.5">
            <legend className="font-semibold text-slate-900">{t('resume.settings')}</legend>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="resumeMaxPages" className={LABEL}>
                {t('resume.maxPages')}
              </label>
              <InfoTip
                label={t('moreAbout', { field: t('resume.maxPages') })}
                text={t('resume.maxPagesHint')}
              />
              <select
                {...register('resumeMaxPages')}
                {...a11y('resumeMaxPages')}
                className={SELECT}
              >
                {(['1', '2', '3'] as const).map((n) => (
                  <option key={n} value={n}>
                    {t('resume.pages', { count: Number(n) })}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  {...register('keepMySections')}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {t('resume.keepSections')}
              </label>
              <InfoTip
                label={t('moreAbout', { field: t('resume.keepSections') })}
                text={t('resume.keepSectionsHint')}
              />
            </div>
          </fieldset>
          <SaveBar
            auto
            label={tFiles('save')}
            savedText={tFiles('saved')}
            busy={isSubmitting}
            showSaved={saved && !isDirty}
            submittedAt={update.submittedAt}
            error={update.isError ? tFiles('saveFailed', { error: errorText(update.error) }) : null}
          />
        </section>
      </form>
      <OtherResumes profile={profile} />
    </div>
  );
}
