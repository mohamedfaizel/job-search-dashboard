import { zodResolver } from '@hookform/resolvers/zod';
import type { Profile } from '@jobsearch/data';
import { RESUME_LANGUAGES, useUpdateProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { FieldErrors } from 'react-hook-form';
import { useFieldArray, useForm } from 'react-hook-form';
import { useErrorText } from '../../../i18n/useErrorText';
import type { ProfileFormValues } from '../schema';
import { profileSchema, profileToForm, toProfileInput } from '../schema';
import { Field, inputClass } from './Field';
import { ResumeUpload } from './ResumeUpload';
import { useLanguageName } from './useLanguageName';

/** The tabs of My profile. The first three hold this one form; the others are separate. */
export type ProfileTab = 'personal' | 'applications' | 'resume' | 'design' | 'matcher';
export const FORM_TABS: ProfileTab[] = ['personal', 'applications', 'resume'];

/** Which tab each field is on, so a save with a mistake opens the tab that shows it. */
const FIELD_TAB: Partial<Record<keyof ProfileFormValues, ProfileTab>> = {
  phone: 'applications',
  address: 'applications',
  workPermit: 'applications',
  noticePeriod: 'applications',
  salaryExpectation: 'applications',
  relocation: 'applications',
  employmentType: 'applications',
  workplacePreference: 'applications',
  drivingLicence: 'applications',
  applicationNotes: 'applications',
  customFields: 'applications',
  resumeText: 'resume',
  resumeLanguage: 'resume',
};

/** The gender codes the API stores; their words are in messages under Profile.personal.genders. */
const GENDERS = [
  ['', 'none'],
  ['female', 'female'],
  ['male', 'male'],
  ['diverse', 'diverse'],
  ['not_specified', 'not_specified'],
] as const;

const card = 'space-y-4 rounded-lg border border-slate-200 bg-white p-5';

interface Props {
  profile: Profile;
  /** Your account name, to suggest a first and last name before you save them. */
  accountName?: string;
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
}

/**
 * Your details and master resume: React Hook Form manages the inputs, Zod validates them. One
 * form across three tabs: hidden tabs stay mounted, so unsaved edits survive switching.
 */
export function ProfileForm({ profile, accountName = '', tab, onTab }: Props) {
  const errorText = useErrorText();
  const t = useTranslations('Profile');
  const tError = useTranslations('Profile.errors');
  const languageName = useLanguageName();
  const listHint = t('listHint');
  // The rules carry their error texts, so they change with the language.
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
    resetField,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: profileToForm(profile, accountName),
  });
  const custom = useFieldArray({ control, name: 'customFields' });

  // A mistake on another tab: open that tab so you can see it.
  const onInvalid = (invalid: FieldErrors<ProfileFormValues>) => {
    const first = Object.keys(invalid)[0] as keyof ProfileFormValues | undefined;
    if (first) onTab(FIELD_TAB[first] ?? 'personal');
  };

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    const result = await update.mutateAsync(toProfileInput(values)).catch(() => null);
    if (result) {
      setSaved(true);
      // The saved (cleaned-up) values become the new starting point, so isDirty resets.
      reset(profileToForm(result));
    }
  }, onInvalid);

  // Props that link each input to its error message for screen readers.
  const a11y = (name: keyof ProfileFormValues) => ({
    id: name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
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
      hidden={!FORM_TABS.includes(tab)}
      className="space-y-6"
    >
      <div hidden={tab !== 'personal'} className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <section aria-labelledby="personal-heading" className={card}>
          <div>
            <h2 id="personal-heading" className="text-lg font-semibold text-slate-900">
              {t('personal.heading')}
            </h2>
            <p className="text-sm text-slate-600">{t('personal.intro')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('personal.firstName')}
              htmlFor="firstName"
              error={errors.firstName?.message}
            >
              <input
                {...register('firstName')}
                {...a11y('firstName')}
                autoComplete="given-name"
                className={inputClass}
              />
            </Field>
            <Field
              label={t('personal.lastName')}
              htmlFor="lastName"
              error={errors.lastName?.message}
            >
              <input
                {...register('lastName')}
                {...a11y('lastName')}
                autoComplete="family-name"
                className={inputClass}
              />
            </Field>
            <Field
              label={t('personal.gender')}
              htmlFor="gender"
              error={errors.gender?.message}
              hint={t('personal.genderHint')}
            >
              <select {...register('gender')} {...a11y('gender')} className={inputClass}>
                {GENDERS.map(([code, key]) => (
                  <option key={code} value={code}>
                    {t(`personal.genders.${key}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={t('personal.dateOfBirth')}
              htmlFor="dateOfBirth"
              error={errors.dateOfBirth?.message}
              hint={t('personal.dateOfBirthHint')}
            >
              <input
                {...register('dateOfBirth')}
                {...a11y('dateOfBirth')}
                type="date"
                autoComplete="bday"
                className={inputClass}
              />
            </Field>
            <Field
              label={t('personal.nationality')}
              htmlFor="nationality"
              error={errors.nationality?.message}
            >
              <input {...register('nationality')} {...a11y('nationality')} className={inputClass} />
            </Field>
          </div>
        </section>
        <section aria-labelledby="about-heading" className={card}>
          <h2 id="about-heading" className="text-lg font-semibold text-slate-900">
            {t('about.heading')}
          </h2>
          <Field
            label={t('about.headline')}
            htmlFor="headline"
            error={errors.headline?.message}
            hint={t('about.headlineHint')}
          >
            <input {...register('headline')} {...a11y('headline')} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('about.targetRoles')}
              htmlFor="targetRoles"
              error={errors.targetRoles?.message}
              hint={listHint}
            >
              <input {...register('targetRoles')} {...a11y('targetRoles')} className={inputClass} />
            </Field>
            <Field
              label={t('about.locations')}
              htmlFor="locations"
              error={errors.locations?.message}
              hint={listHint}
            >
              <input {...register('locations')} {...a11y('locations')} className={inputClass} />
            </Field>
            <Field
              label={t('about.skills')}
              htmlFor="skills"
              error={errors.skills?.message}
              hint={listHint}
            >
              <input {...register('skills')} {...a11y('skills')} className={inputClass} />
            </Field>
            <Field
              label={t('about.languages')}
              htmlFor="languages"
              error={errors.languages?.message}
              hint={t('about.languagesHint')}
            >
              <input {...register('languages')} {...a11y('languages')} className={inputClass} />
            </Field>
            <Field
              label={t('about.yearsExperience')}
              htmlFor="yearsExperience"
              error={errors.yearsExperience?.message}
            >
              <input
                {...register('yearsExperience')}
                {...a11y('yearsExperience')}
                inputMode="numeric"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t('about.linkedin')}
              htmlFor="linkedinUrl"
              error={errors.linkedinUrl?.message}
            >
              <input
                {...register('linkedinUrl')}
                {...a11y('linkedinUrl')}
                type="url"
                placeholder="https://www.linkedin.com/in/…"
                className={inputClass}
              />
            </Field>
            <Field label={t('about.github')} htmlFor="githubUrl" error={errors.githubUrl?.message}>
              <input
                {...register('githubUrl')}
                {...a11y('githubUrl')}
                type="url"
                placeholder="https://github.com/…"
                className={inputClass}
              />
            </Field>
            <Field
              label={t('about.website')}
              htmlFor="websiteUrl"
              error={errors.websiteUrl?.message}
            >
              <input
                {...register('websiteUrl')}
                {...a11y('websiteUrl')}
                type="url"
                className={inputClass}
              />
            </Field>
          </div>
        </section>
      </div>

      <div hidden={tab !== 'applications'} className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <section aria-labelledby="answers-heading" className={card}>
          <div>
            <h2 id="answers-heading" className="text-lg font-semibold text-slate-900">
              {t('answers.heading')}
            </h2>
            <p className="text-sm text-slate-600">{t('answers.intro')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('answers.phone')} htmlFor="phone" error={errors.phone?.message}>
              <input
                {...register('phone')}
                {...a11y('phone')}
                type="tel"
                autoComplete="tel"
                placeholder="+49 151 …"
                className={inputClass}
              />
            </Field>
            <Field
              label={t('answers.address')}
              htmlFor="address"
              error={errors.address?.message}
              hint={t('answers.addressHint')}
            >
              <input {...register('address')} {...a11y('address')} className={inputClass} />
            </Field>
            <Field
              label={t('answers.workPermit')}
              htmlFor="workPermit"
              error={errors.workPermit?.message}
              hint={t('answers.workPermitHint')}
            >
              <input {...register('workPermit')} {...a11y('workPermit')} className={inputClass} />
            </Field>
            <Field
              label={t('answers.noticePeriod')}
              htmlFor="noticePeriod"
              error={errors.noticePeriod?.message}
              hint={t('answers.noticePeriodHint')}
            >
              <input
                {...register('noticePeriod')}
                {...a11y('noticePeriod')}
                className={inputClass}
              />
            </Field>
            <Field
              label={t('answers.salary')}
              htmlFor="salaryExpectation"
              error={errors.salaryExpectation?.message}
              hint={t('answers.salaryHint')}
            >
              <input
                {...register('salaryExpectation')}
                {...a11y('salaryExpectation')}
                className={inputClass}
              />
            </Field>
            <Field
              label={t('answers.relocation')}
              htmlFor="relocation"
              error={errors.relocation?.message}
              hint={t('answers.relocationHint')}
            >
              <input {...register('relocation')} {...a11y('relocation')} className={inputClass} />
            </Field>
          </div>
          <Field
            label={t('answers.notes')}
            htmlFor="applicationNotes"
            error={errors.applicationNotes?.message}
            hint={t('answers.notesHint')}
          >
            <textarea
              {...register('applicationNotes')}
              {...a11y('applicationNotes')}
              rows={5}
              className={inputClass}
            />
          </Field>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="more-heading" className={card}>
            <h2 id="more-heading" className="text-lg font-semibold text-slate-900">
              {t('looking.heading')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('looking.employmentType')}
                htmlFor="employmentType"
                error={errors.employmentType?.message}
                hint={t('looking.employmentTypeHint')}
              >
                <input
                  {...register('employmentType')}
                  {...a11y('employmentType')}
                  className={inputClass}
                />
              </Field>
              <Field
                label={t('looking.workplace')}
                htmlFor="workplacePreference"
                error={errors.workplacePreference?.message}
                hint={t('looking.workplaceHint')}
              >
                <input
                  {...register('workplacePreference')}
                  {...a11y('workplacePreference')}
                  className={inputClass}
                />
              </Field>
              <Field
                label={t('looking.drivingLicence')}
                htmlFor="drivingLicence"
                error={errors.drivingLicence?.message}
                hint={t('looking.drivingLicenceHint')}
              >
                <input
                  {...register('drivingLicence')}
                  {...a11y('drivingLicence')}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          <section aria-labelledby="custom-heading" className={card}>
            <div>
              <h2 id="custom-heading" className="text-lg font-semibold text-slate-900">
                {t('custom.heading')}
              </h2>
              <p className="text-sm text-slate-600">{t('custom.intro')}</p>
            </div>
            {custom.fields.length > 0 && (
              <ul className="space-y-2">
                {custom.fields.map((row, index) => {
                  const rowErrors = errors.customFields?.[index];
                  return (
                    <li key={row.id} className="flex flex-wrap items-start gap-2">
                      <div className="min-w-32 flex-1">
                        <input
                          {...register(`customFields.${index}.label`)}
                          aria-label={t('custom.name', { n: index + 1 })}
                          aria-invalid={rowErrors?.label ? true : undefined}
                          placeholder={t('custom.namePlaceholder')}
                          className={inputClass}
                        />
                        {rowErrors?.label && (
                          <p role="alert" className="text-xs text-red-700">
                            {rowErrors.label.message}
                          </p>
                        )}
                      </div>
                      <div className="min-w-48 flex-[2]">
                        <input
                          {...register(`customFields.${index}.value`)}
                          aria-label={t('custom.value', { n: index + 1 })}
                          aria-invalid={rowErrors?.value ? true : undefined}
                          placeholder={t('custom.valuePlaceholder')}
                          className={inputClass}
                        />
                        {rowErrors?.value && (
                          <p role="alert" className="text-xs text-red-700">
                            {rowErrors.value.message}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          custom.remove(index);
                        }}
                        aria-label={t('custom.remove', { n: index + 1 })}
                        title={t('custom.removeTitle')}
                        className="rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              disabled={custom.fields.length >= 30}
              onClick={() => {
                custom.append({ label: '', value: '' });
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {t('custom.add')}
            </button>
          </section>
        </div>
      </div>

      <section aria-labelledby="resume-heading" hidden={tab !== 'resume'} className={card}>
        <div>
          <h2 id="resume-heading" className="text-lg font-semibold text-slate-900">
            {t('resume.heading')}
          </h2>
          <p className="text-sm text-slate-600">{t('resume.intro')}</p>
        </div>
        <ResumeUpload
          fileName={profile.resumeFileName}
          onUploaded={(uploaded) => {
            // The upload already saved the text, so it becomes the field's saved value.
            // Other fields keep any edits the user hasn't saved yet.
            resetField('resumeText', { defaultValue: uploaded.resumeText });
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
        <Field label={t('resume.text')} htmlFor="resumeText" error={errors.resumeText?.message}>
          <textarea
            {...register('resumeText')}
            {...a11y('resumeText')}
            rows={16}
            className={`${inputClass} font-mono`}
          />
        </Field>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? t('saving') : t('save')}
        </button>
        {saved && !isDirty && (
          <p role="status" className="text-sm text-emerald-700">
            {t('saved')}
          </p>
        )}
        {update.isError && (
          <p role="alert" className="text-sm text-red-700">
            {t('saveFailed', { error: errorText(update.error) })}
          </p>
        )}
      </div>
    </form>
  );
}
