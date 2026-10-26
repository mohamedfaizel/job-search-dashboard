import { zodResolver } from '@hookform/resolvers/zod';
import { getErrorMessage, useSyncJobs } from '@jobsearch/data';
import { useForm, useWatch } from 'react-hook-form';
import type { SyncFormValues } from '../schema';
import { defaultSyncForm, syncFormSchema, toSyncJobsInput } from '../schema';
import { Field, inputClass } from './Field';

/** Pull fresh postings from JobsPipe into the database. */
export function SyncPanel() {
  const sync = useSyncJobs();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SyncFormValues>({
    resolver: zodResolver(syncFormSchema),
    defaultValues: defaultSyncForm,
  });

  const [pageSize, maxPages] = useWatch({ control, name: ['pageSize', 'maxPages'] });
  const maxCredits = Number(pageSize) * Number(maxPages);

  const onSubmit = handleSubmit((values) => {
    sync.mutate(toSyncJobsInput(values));
  });

  const a11y = (name: keyof SyncFormValues) => ({
    id: `sync-${name}`,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `sync-${name}-error` : undefined,
  });

  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e);
      }}
      noValidate
      aria-labelledby="sync-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <div>
        <h2 id="sync-heading" className="text-lg font-semibold text-slate-900">
          Import from JobsPipe
        </h2>
        <p className="text-sm text-slate-600">Each job fetched uses one JobsPipe credit.</p>
      </div>

      <Field
        label="Job titles"
        htmlFor="sync-titles"
        error={errors.titles?.message}
        hint="Comma separated"
        required
      >
        <input {...register('titles')} {...a11y('titles')} className={inputClass} />
      </Field>
      <Field label="Skills" htmlFor="sync-skills" hint="Optional, comma separated">
        <input {...register('skills')} {...a11y('skills')} className={inputClass} />
      </Field>
      <Field
        label="Countries"
        htmlFor="sync-countryCodes"
        error={errors.countryCodes?.message}
        hint="Optional, e.g. US, DE"
      >
        <input {...register('countryCodes')} {...a11y('countryCodes')} className={inputClass} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Max age (days)" htmlFor="sync-maxAgeDays" error={errors.maxAgeDays?.message}>
          <input
            inputMode="numeric"
            {...register('maxAgeDays')}
            {...a11y('maxAgeDays')}
            className={inputClass}
          />
        </Field>
        <Field label="Jobs per page" htmlFor="sync-pageSize" error={errors.pageSize?.message}>
          <input
            inputMode="numeric"
            {...register('pageSize')}
            {...a11y('pageSize')}
            className={inputClass}
          />
        </Field>
        <Field label="Max pages" htmlFor="sync-maxPages" error={errors.maxPages?.message}>
          <input
            inputMode="numeric"
            {...register('maxPages')}
            {...a11y('maxPages')}
            className={inputClass}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={sync.isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {sync.isPending
          ? 'Importing…'
          : Number.isFinite(maxCredits)
            ? `Import (up to ${maxCredits} credits)`
            : 'Import'}
      </button>

      {sync.isError && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Import failed: {getErrorMessage(sync.error)}
        </p>
      )}
      {sync.data && (
        <div role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Fetched {sync.data.fetched} jobs: {sync.data.created} new, {sync.data.updated} updated.
          {sync.data.hasMore && ' More are available: raise "Max pages" to fetch them.'}
          {sync.data.creditsRemaining !== null &&
            ` ${sync.data.creditsRemaining.toLocaleString()} credits left.`}
        </div>
      )}
    </form>
  );
}
