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

const card = 'space-y-2.5 rounded-lg border border-slate-200 bg-white p-3';
const SELECT = 'rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm';
const LABEL = 'text-sm font-medium text-slate-700';

/**
 * The Setup panel of the Resume page, three short columns side by side: your resume's language
 * and file, the settings shared by all your resumes (page limit, keep my headings) and your
 * resumes in other languages. Explanations sit behind ⓘ, suggestions behind a pill.
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
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        onChange={() => {
          setSaved(false);
        }}
        noValidate
        // The two cards of the form are columns of the grid.
        className="contents"
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
