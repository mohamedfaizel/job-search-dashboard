import { zodResolver } from '@hookform/resolvers/zod';
import type { Profile } from '@jobsearch/data';
import { getErrorMessage, RESUME_LANGUAGES, useUpdateProfile } from '@jobsearch/data';
import { useState } from 'react';
import type { FieldErrors } from 'react-hook-form';
import { useFieldArray, useForm } from 'react-hook-form';
import type { ProfileFormValues } from '../schema';
import { profileSchema, profileToForm, toProfileInput } from '../schema';
import { Field, inputClass } from './Field';
import { ResumeUpload } from './ResumeUpload';

const LIST_HINT = 'Separate with commas';

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

/** Words for the gender codes the API stores. */
const GENDER_LABELS = [
  ['', 'Not given'],
  ['female', 'Female'],
  ['male', 'Male'],
  ['diverse', 'Diverse'],
  ['not_specified', 'Prefer not to say'],
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
    resolver: zodResolver(profileSchema),
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
              Personal details
            </h2>
            <p className="text-sm text-slate-600">
              What forms ask about you. Your first and last name also become your account name, used
              on resumes and letters.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
              <input
                {...register('firstName')}
                {...a11y('firstName')}
                autoComplete="given-name"
                className={inputClass}
              />
            </Field>
            <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
              <input
                {...register('lastName')}
                {...a11y('lastName')}
                autoComplete="family-name"
                className={inputClass}
              />
            </Field>
            <Field
              label="Gender"
              htmlFor="gender"
              error={errors.gender?.message}
              hint="Only for forms that ask. Never put on resumes."
            >
              <select {...register('gender')} {...a11y('gender')} className={inputClass}>
                {GENDER_LABELS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Date of birth"
              htmlFor="dateOfBirth"
              error={errors.dateOfBirth?.message}
              hint="Only for forms that ask"
            >
              <input
                {...register('dateOfBirth')}
                {...a11y('dateOfBirth')}
                type="date"
                autoComplete="bday"
                className={inputClass}
              />
            </Field>
            <Field label="Nationality" htmlFor="nationality" error={errors.nationality?.message}>
              <input {...register('nationality')} {...a11y('nationality')} className={inputClass} />
            </Field>
          </div>
        </section>
        <section aria-labelledby="about-heading" className={card}>
          <h2 id="about-heading" className="text-lg font-semibold text-slate-900">
            About you
          </h2>
          <Field
            label="Headline"
            htmlFor="headline"
            error={errors.headline?.message}
            hint="One line, like “Frontend engineer who loves design systems”"
          >
            <input {...register('headline')} {...a11y('headline')} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Roles you want"
              htmlFor="targetRoles"
              error={errors.targetRoles?.message}
              hint={LIST_HINT}
            >
              <input {...register('targetRoles')} {...a11y('targetRoles')} className={inputClass} />
            </Field>
            <Field
              label="Where you want to work"
              htmlFor="locations"
              error={errors.locations?.message}
              hint={LIST_HINT}
            >
              <input {...register('locations')} {...a11y('locations')} className={inputClass} />
            </Field>
            <Field label="Skills" htmlFor="skills" error={errors.skills?.message} hint={LIST_HINT}>
              <input {...register('skills')} {...a11y('skills')} className={inputClass} />
            </Field>
            <Field
              label="Languages"
              htmlFor="languages"
              error={errors.languages?.message}
              hint="With your real level, e.g. German A2, English C1. Resumes copy it exactly."
            >
              <input {...register('languages')} {...a11y('languages')} className={inputClass} />
            </Field>
            <Field
              label="Years of experience"
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
            <Field label="LinkedIn" htmlFor="linkedinUrl" error={errors.linkedinUrl?.message}>
              <input
                {...register('linkedinUrl')}
                {...a11y('linkedinUrl')}
                type="url"
                placeholder="https://www.linkedin.com/in/…"
                className={inputClass}
              />
            </Field>
            <Field label="GitHub" htmlFor="githubUrl" error={errors.githubUrl?.message}>
              <input
                {...register('githubUrl')}
                {...a11y('githubUrl')}
                type="url"
                placeholder="https://github.com/…"
                className={inputClass}
              />
            </Field>
            <Field label="Website" htmlFor="websiteUrl" error={errors.websiteUrl?.message}>
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
              Application answers
            </h2>
            <p className="text-sm text-slate-600">
              What every application form asks. The Apply kit gives these to Claude for the cover
              letter and to Claude in Chrome to fill in forms, exactly as you write them here. Leave
              out anything you don’t want shared.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
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
              label="Address"
              htmlFor="address"
              error={errors.address?.message}
              hint="City and country, or the full address forms ask for"
            >
              <input {...register('address')} {...a11y('address')} className={inputClass} />
            </Field>
            <Field
              label="Work permit"
              htmlFor="workPermit"
              error={errors.workPermit?.message}
              hint="e.g. EU Blue Card, or no visa needed in the EU"
            >
              <input {...register('workPermit')} {...a11y('workPermit')} className={inputClass} />
            </Field>
            <Field
              label="Notice period / earliest start"
              htmlFor="noticePeriod"
              error={errors.noticePeriod?.message}
              hint="e.g. 1 month, or immediately"
            >
              <input
                {...register('noticePeriod')}
                {...a11y('noticePeriod')}
                className={inputClass}
              />
            </Field>
            <Field
              label="Salary expectation"
              htmlFor="salaryExpectation"
              error={errors.salaryExpectation?.message}
              hint="e.g. €65,000 a year"
            >
              <input
                {...register('salaryExpectation')}
                {...a11y('salaryExpectation')}
                className={inputClass}
              />
            </Field>
            <Field
              label="Willing to relocate"
              htmlFor="relocation"
              error={errors.relocation?.message}
              hint="e.g. Yes, anywhere in Germany"
            >
              <input {...register('relocation')} {...a11y('relocation')} className={inputClass} />
            </Field>
          </div>
          <Field
            label="Saved answers"
            htmlFor="applicationNotes"
            error={errors.applicationNotes?.message}
            hint="Short answers you reuse, like why you are looking for a new job. Claude adapts them to each job."
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
              What you are looking for
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Employment type"
                htmlFor="employmentType"
                error={errors.employmentType?.message}
                hint="e.g. Full-time"
              >
                <input
                  {...register('employmentType')}
                  {...a11y('employmentType')}
                  className={inputClass}
                />
              </Field>
              <Field
                label="Remote, hybrid or on-site"
                htmlFor="workplacePreference"
                error={errors.workplacePreference?.message}
                hint="e.g. Remote or hybrid"
              >
                <input
                  {...register('workplacePreference')}
                  {...a11y('workplacePreference')}
                  className={inputClass}
                />
              </Field>
              <Field
                label="Driving licence"
                htmlFor="drivingLicence"
                error={errors.drivingLicence?.message}
                hint="e.g. Class B, or none"
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
                Your own fields
              </h2>
              <p className="text-sm text-slate-600">
                Anything else forms ask, like Xing, pronouns or a portfolio. The Apply kit passes
                them on as you write them.
              </p>
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
                          aria-label={`Field ${String(index + 1)} name`}
                          aria-invalid={rowErrors?.label ? true : undefined}
                          placeholder="Name, e.g. Xing"
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
                          aria-label={`Field ${String(index + 1)} value`}
                          aria-invalid={rowErrors?.value ? true : undefined}
                          placeholder="Value"
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
                        aria-label={`Remove field ${String(index + 1)}`}
                        title="Remove this field"
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
              + Add a field
            </button>
          </section>
        </div>
      </div>

      <section aria-labelledby="resume-heading" hidden={tab !== 'resume'} className={card}>
        <div>
          <h2 id="resume-heading" className="text-lg font-semibold text-slate-900">
            Master resume
          </h2>
          <p className="text-sm text-slate-600">
            Your full resume as plain text. Match scores and tailored resumes start from this.
          </p>
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
          label="Language of this resume"
          htmlFor="resumeLanguage"
          hint="Jobs in this language are checked against it. Add other languages below."
        >
          <select
            {...register('resumeLanguage')}
            {...a11y('resumeLanguage')}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            {Object.entries(RESUME_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Resume text" htmlFor="resumeText" error={errors.resumeText?.message}>
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
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Save profile'}
        </button>
        {saved && !isDirty && (
          <p role="status" className="text-sm text-emerald-700">
            Profile saved.
          </p>
        )}
        {update.isError && (
          <p role="alert" className="text-sm text-red-700">
            Could not save: {getErrorMessage(update.error)}
          </p>
        )}
      </div>
    </form>
  );
}
