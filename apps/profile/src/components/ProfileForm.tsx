import { zodResolver } from '@hookform/resolvers/zod';
import type { Profile } from '@jobsearch/data';
import { getErrorMessage, useUpdateProfile } from '@jobsearch/data';
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
      className="space-y-6"
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
        aria-labelledby="resume-heading"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
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
