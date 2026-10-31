import { zodResolver } from '@hookform/resolvers/zod';
import type { Profile } from '@jobsearch/data';
import { getErrorMessage, RESUME_LANGUAGES, useUpdateProfile } from '@jobsearch/data';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ProfileFormValues } from '../schema';
import { profileSchema, profileToForm, toProfileInput } from '../schema';
import { Field, inputClass } from './Field';
import { ResumeUpload } from './ResumeUpload';

const LIST_HINT = 'Separate with commas';

/** Your details and master resume: React Hook Form manages the inputs, Zod validates them. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    resetField,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: profileToForm(profile),
  });

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    const result = await update.mutateAsync(toProfileInput(values)).catch(() => null);
    if (result) {
      setSaved(true);
      // The saved (cleaned-up) values become the new starting point, so isDirty resets.
      reset(profileToForm(result));
    }
  });

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
      className="grid gap-6 xl:grid-cols-2 xl:items-start"
    >
      <section
        aria-labelledby="about-heading"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
      >
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

      <section
        aria-labelledby="answers-heading"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
      >
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
            <input {...register('noticePeriod')} {...a11y('noticePeriod')} className={inputClass} />
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

      <section
        aria-labelledby="resume-heading"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2"
      >
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

      <div className="flex items-center gap-3 xl:col-span-2">
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
