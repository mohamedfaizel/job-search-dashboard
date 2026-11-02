import { zodResolver } from '@hookform/resolvers/zod';
import { APPLICATION_STATUSES, getErrorMessage, useCreateJob, WORKPLACES } from '@jobsearch/data';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useJobFormat } from '@/features/jobs/useJobFormat';
import { countriesIn } from '../countries';
import type { JobFormValues } from '../schema';
import { emptyJobForm, jobFormSchema, SENIORITIES, toCreateJobInput } from '../schema';
import { Field, inputClass } from './Field';

/** Add a job by hand: React Hook Form manages the inputs, Zod validates them. */
export function AddJobForm() {
  const t = useTranslations('AddJobs');
  const locale = useLocale();
  const f = useJobFormat();
  const schema = useMemo(() => jobFormSchema((key, values) => t(`errors.${key}`, values)), [t]);
  const createJob = useCreateJob();
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JobFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyJobForm,
  });

  const onSubmit = handleSubmit(async (values) => {
    setSavedTitle(null);
    const job = await createJob.mutateAsync(toCreateJobInput(values)).catch(() => null);
    if (job) {
      setSavedTitle(f.jobName(job));
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
        {t('form.heading')}
      </h2>

      {savedTitle && (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          {t('form.saved', { title: savedTitle })}
        </p>
      )}
      {createJob.isError && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {t('form.saveError', { error: getErrorMessage(createJob.error) })}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t('form.title')} htmlFor="title" error={errors.title?.message} required>
          <input {...register('title')} {...a11y('title')} className={inputClass} />
        </Field>
        <Field
          label={t('form.company')}
          htmlFor="companyName"
          error={errors.companyName?.message}
          required
        >
          <input {...register('companyName')} {...a11y('companyName')} className={inputClass} />
        </Field>
        <Field
          label={t('form.url')}
          htmlFor="url"
          error={errors.url?.message}
          className="sm:col-span-2 lg:col-span-1"
        >
          <input
            type="url"
            placeholder="https://"
            {...register('url')}
            {...a11y('url')}
            className={inputClass}
          />
        </Field>
        <Field label={t('form.city')} htmlFor="city" error={errors.city?.message}>
          <input {...register('city')} {...a11y('city')} className={inputClass} />
        </Field>
        <Field label={t('form.country')} htmlFor="countryCode" error={errors.countryCode?.message}>
          <select {...register('countryCode')} {...a11y('countryCode')} className={inputClass}>
            <option value="">{t('notSpecified')}</option>
            {countriesIn(locale).map(([code, name]) => (
              <option key={code} value={code}>
                {name} · {code}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('form.workplace')} htmlFor="workplace">
          <select {...register('workplace')} {...a11y('workplace')} className={inputClass}>
            <option value="">{t('notSpecified')}</option>
            {WORKPLACES.map((w) => (
              <option key={w} value={w}>
                {f.workplace(w)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('form.seniority')} htmlFor="seniority">
          <select {...register('seniority')} {...a11y('seniority')} className={inputClass}>
            <option value="">{t('notSpecified')}</option>
            {SENIORITIES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('form.jobFunction')}
          htmlFor="jobFunction"
          error={errors.jobFunction?.message}
          hint={t('form.functionHint')}
        >
          <input {...register('jobFunction')} {...a11y('jobFunction')} className={inputClass} />
        </Field>
        <Field label={t('form.industry')} htmlFor="industry" error={errors.industry?.message}>
          <input {...register('industry')} {...a11y('industry')} className={inputClass} />
        </Field>
        <Field
          label={t('form.skills')}
          htmlFor="skills"
          hint={t('form.skillsHint')}
          className="sm:col-span-2 lg:col-span-3"
        >
          <input {...register('skills')} {...a11y('skills')} className={inputClass} />
        </Field>
        <Field
          label={t('form.salaryMin')}
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
          label={t('form.salaryMax')}
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
        <Field label={t('form.status')} htmlFor="applicationStatus">
          <select
            {...register('applicationStatus')}
            {...a11y('applicationStatus')}
            className={inputClass}
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {f.status(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('form.description')}
          htmlFor="description"
          error={errors.description?.message}
          className="sm:col-span-2 lg:col-span-3"
        >
          <textarea
            rows={6}
            {...register('description')}
            {...a11y('description')}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? t('form.saving') : t('form.save')}
        </button>
        <button
          type="button"
          onClick={() => {
            reset(emptyJobForm);
          }}
          className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          {t('form.clear')}
        </button>
      </div>
    </form>
  );
}
