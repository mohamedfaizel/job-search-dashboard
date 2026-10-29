import { zodResolver } from '@hookform/resolvers/zod';
import { APPLICATION_STATUSES, getErrorMessage, useCreateJob, WORKPLACES } from '@jobsearch/data';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { COUNTRIES } from '../countries';
import type { JobFormValues } from '../schema';
import { emptyJobForm, jobFormSchema, SENIORITIES, toCreateJobInput } from '../schema';
import { Field, inputClass } from './Field';

const WORKPLACE_LABELS = { ONSITE: 'On-site', HYBRID: 'Hybrid', REMOTE: 'Remote' } as const;
const STATUS_LABELS = {
  NONE: 'Not applied',
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEWING: 'Interviewing',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
} as const;

/** Add a job by hand: React Hook Form manages the inputs, Zod validates them. */
export function AddJobForm() {
  const createJob = useCreateJob();
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: emptyJobForm,
  });

  const onSubmit = handleSubmit(async (values) => {
    setSavedTitle(null);
    const job = await createJob.mutateAsync(toCreateJobInput(values)).catch(() => null);
    if (job) {
      setSavedTitle(`${job.title} at ${job.company.name}`);
      reset(emptyJobForm);
    }
  });

  // Props that link each input to its error message for screen readers.
  const a11y = (name: keyof JobFormValues) => ({
    id: name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e);
      }}
      noValidate
      aria-labelledby="add-job-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="add-job-heading" className="text-lg font-semibold text-slate-900">
        Add a job by hand
      </h2>

      {savedTitle && (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Saved “{savedTitle}”. It’s now in the Job posts table.
        </p>
      )}
      {createJob.isError && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Could not save the job: {getErrorMessage(createJob.error)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job title" htmlFor="title" error={errors.title?.message} required>
          <input {...register('title')} {...a11y('title')} className={inputClass} />
        </Field>
        <Field label="Company" htmlFor="companyName" error={errors.companyName?.message} required>
          <input {...register('companyName')} {...a11y('companyName')} className={inputClass} />
        </Field>
        <Field
          label="Link to the posting"
          htmlFor="url"
          error={errors.url?.message}
          className="sm:col-span-2"
        >
          <input
            type="url"
            placeholder="https://"
            {...register('url')}
            {...a11y('url')}
            className={inputClass}
          />
        </Field>
        <Field label="City" htmlFor="city" error={errors.city?.message}>
          <input {...register('city')} {...a11y('city')} className={inputClass} />
        </Field>
        <Field label="Country" htmlFor="countryCode" error={errors.countryCode?.message}>
          <select {...register('countryCode')} {...a11y('countryCode')} className={inputClass}>
            <option value="">Not specified</option>
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name} · {code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Workplace" htmlFor="workplace">
          <select {...register('workplace')} {...a11y('workplace')} className={inputClass}>
            <option value="">Not specified</option>
            {WORKPLACES.map((w) => (
              <option key={w} value={w}>
                {WORKPLACE_LABELS[w]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Seniority" htmlFor="seniority">
          <select {...register('seniority')} {...a11y('seniority')} className={inputClass}>
            <option value="">Not specified</option>
            {SENIORITIES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Function"
          htmlFor="jobFunction"
          error={errors.jobFunction?.message}
          hint="e.g. Engineering"
        >
          <input {...register('jobFunction')} {...a11y('jobFunction')} className={inputClass} />
        </Field>
        <Field label="Industry" htmlFor="industry" error={errors.industry?.message}>
          <input {...register('industry')} {...a11y('industry')} className={inputClass} />
        </Field>
        <Field
          label="Skills"
          htmlFor="skills"
          hint="Separate with commas: react, typescript"
          className="sm:col-span-2"
        >
          <input {...register('skills')} {...a11y('skills')} className={inputClass} />
        </Field>
        <Field
          label="Minimum salary (USD / year)"
          htmlFor="salaryMinUsd"
          error={errors.salaryMinUsd?.message}
        >
          <input
            inputMode="numeric"
            {...register('salaryMinUsd')}
            {...a11y('salaryMinUsd')}
            className={inputClass}
          />
        </Field>
        <Field
          label="Maximum salary (USD / year)"
          htmlFor="salaryMaxUsd"
          error={errors.salaryMaxUsd?.message}
        >
          <input
            inputMode="numeric"
            {...register('salaryMaxUsd')}
            {...a11y('salaryMaxUsd')}
            className={inputClass}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="description"
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <textarea
            rows={6}
            {...register('description')}
            {...a11y('description')}
            className={inputClass}
          />
        </Field>
        <Field label="Your status" htmlFor="applicationStatus">
          <select
            {...register('applicationStatus')}
            {...a11y('applicationStatus')}
            className={inputClass}
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save job'}
        </button>
        <button
          type="button"
          onClick={() => {
            reset(emptyJobForm);
          }}
          className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
