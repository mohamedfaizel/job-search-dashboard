import { zodResolver } from '@hookform/resolvers/zod';
import type { EmploymentType, SavedSearch } from '@jobsearch/data';
import {
  EMPLOYMENT_TYPES,
  getErrorMessage,
  useMyProfile,
  useSaveSearch,
  useSyncJobs,
} from '@jobsearch/data';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { formatDateTime, plural } from '../format';
import type { SyncFormValues } from '../schema';
import {
  defaultSyncForm,
  savedSearchToForm,
  syncFormSchema,
  toSavedSearchInput,
  toSyncJobsInput,
} from '../schema';
import { CountrySelect } from './CountrySelect';
import { Field, inputClass } from './Field';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
];

const JOB_TYPE_LABELS: Record<EmploymentType, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

const CHECKBOX = 'size-4 rounded border-slate-300 text-indigo-600';

/** Adds a value to a list, or takes it out. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface Props {
  /** A saved search to start from. Saving with the same name updates it. */
  loaded?: SavedSearch | null;
}

/** Pull fresh postings from JobsPipe into the database, and save searches to reuse. */
export function SyncPanel({ loaded = null }: Props) {
  const sync = useSyncJobs();
  const save = useSaveSearch();
  const [name, setName] = useState(loaded?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const updating = loaded !== null && name.trim() === loaded.name;
  const { data: profile } = useMyProfile();
  const hasProfile = Boolean(
    profile && (profile.targetRoles.length || profile.skills.length || profile.locations.length),
  );
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<SyncFormValues>({
    resolver: zodResolver(syncFormSchema),
    defaultValues: loaded ? savedSearchToForm(loaded) : defaultSyncForm,
  });

  const [pageSize, maxPages, maxAgeDays] = useWatch({
    control,
    name: ['pageSize', 'maxPages', 'maxAgeDays'],
  });
  const maxCredits = Number(pageSize) * Number(maxPages);

  const filters = useWatch({
    control,
    name: [
      'languages',
      'skipFluentGerman',
      'remoteOnly',
      'excludeTitles',
      'employmentTypes',
      'minSalaryEur',
    ],
  });
  const activeFilters = [
    filters[0].length > 0,
    filters[1],
    filters[2],
    filters[3].trim() !== '',
    filters[4].length > 0,
    filters[5].trim() !== '',
  ].filter(Boolean).length;
  // Open at first when a loaded search uses any of them, and whenever one has a mistake.
  const [moreOpen, setMoreOpen] = useState(activeFilters > 0);
  const moreError = Boolean(errors.minSalaryEur ?? errors.excludeTitles);

  // The page settings sit in a fold to keep the form short; a mistake in them opens it.
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const pageSettingsError = Boolean(errors.maxAgeDays ?? errors.pageSize ?? errors.maxPages);

  // "Continue import" repeats the last search from where it stopped, with the same page settings.
  const lastInput = sync.variables;
  const continueCredits = (lastInput?.pageSize ?? 0) * (lastInput?.maxPages ?? 0);

  const onSubmit = handleSubmit((values) => {
    sync.mutate(toSyncJobsInput(values));
  });

  const onSave = handleSubmit((values) => {
    if (!name.trim()) {
      setNameError('Give the search a name');
      return;
    }
    setNameError(null);
    save.mutate({
      ...(updating ? { id: loaded.id } : {}),
      input: toSavedSearchInput(name, values),
    });
  });

  /** Copies the roles, skills and places from the profile page into the search. */
  const fillFromProfile = () => {
    if (!profile) return;
    const fill = (field: 'titles' | 'skills' | 'locations', values: string[]) => {
      if (values.length) setValue(field, values.join(', '), { shouldValidate: true });
    };
    fill('titles', profile.targetRoles);
    fill('skills', profile.skills);
    fill('locations', profile.locations);
  };

  const a11y = (field: keyof SyncFormValues) => ({
    id: `sync-${field}`,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `sync-${field}-error` : undefined,
  });

  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e);
      }}
      noValidate
      aria-labelledby="sync-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div>
        <h2 id="sync-heading" className="text-lg font-semibold text-slate-900">
          Import from JobsPipe
        </h2>
        <p className="text-sm text-slate-600">
          Each job fetched uses one JobsPipe credit. Jobs you already have are updated, never added
          twice, and fetching them again in the same month is free.
        </p>
      </div>

      {hasProfile && (
        <button
          type="button"
          onClick={fillFromProfile}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Fill from my profile
        </button>
      )}

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
        hint="Pick one or more, or leave it on Worldwide"
      >
        <Controller
          control={control}
          name="countryCodes"
          render={({ field }) => (
            <CountrySelect
              id="sync-countryCodes"
              value={field.value}
              onChange={field.onChange}
              invalid={Boolean(errors.countryCodes)}
              describedBy={errors.countryCodes ? 'sync-countryCodes-error' : undefined}
            />
          )}
        />
      </Field>
      <Field
        label="Cities or regions"
        htmlFor="sync-locations"
        hint="Optional, comma separated, e.g. Berlin, Bavaria"
      >
        <input {...register('locations')} {...a11y('locations')} className={inputClass} />
      </Field>
      <details
        open={moreOpen || moreError}
        onToggle={(e) => {
          setMoreOpen(e.currentTarget.open);
        }}
        className="rounded-md border border-slate-200 px-3 py-2"
      >
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          More filters{' '}
          {activeFilters > 0 && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
              {activeFilters} on
            </span>
          )}
        </summary>
        <div className="mt-3 space-y-4">
          <Controller
            control={control}
            name="languages"
            render={({ field }) => (
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium text-slate-700">Ad written in</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {LANGUAGES.map((lang) => (
                    <label key={lang.code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.value.includes(lang.code)}
                        onChange={() => {
                          field.onChange(toggle(field.value, lang.code));
                        }}
                        className={CHECKBOX}
                      />
                      {lang.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  None ticked = any language. Many German jobs are posted in English, and ads with
                  no language yet are kept.
                </p>
              </fieldset>
            )}
          />

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                {...register('skipFluentGerman')}
                className={`mt-0.5 ${CHECKBOX}`}
              />
              <span>
                <span className="font-medium text-slate-800">Skip ads that need fluent German</span>
                <span className="block text-xs text-slate-500">
                  Catches German ads asking for fließende, verhandlungssichere or C1
                  Deutschkenntnisse. English ads saying “fluent German” get the German tag in Job
                  posts instead.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" {...register('remoteOnly')} className={`mt-0.5 ${CHECKBOX}`} />
              <span className="font-medium text-slate-800">Remote only</span>
            </label>
          </div>

          <Field
            label="Skip titles with"
            htmlFor="sync-excludeTitles"
            hint="Comma separated, e.g. Werkstudent, Praktikum, Intern. Matches part of a word."
          >
            <input
              {...register('excludeTitles')}
              {...a11y('excludeTitles')}
              className={inputClass}
            />
          </Field>

          <Controller
            control={control}
            name="employmentTypes"
            render={({ field }) => (
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium text-slate-700">Job type</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {EMPLOYMENT_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.value.includes(type)}
                        onChange={() => {
                          field.onChange(toggle(field.value, type));
                        }}
                        className={CHECKBOX}
                      />
                      {JOB_TYPE_LABELS[type]}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  None ticked = any type. Ads that don’t say are kept.
                </p>
              </fieldset>
            )}
          />

          <Field
            label="Minimum salary (€ a year)"
            htmlFor="sync-minSalaryEur"
            error={errors.minSalaryEur?.message}
            hint="Only about half of ads post a salary, and the rest are skipped. Leave empty to keep them."
          >
            <input
              inputMode="numeric"
              placeholder="e.g. 60000"
              {...register('minSalaryEur')}
              {...a11y('minSalaryEur')}
              className={inputClass}
            />
          </Field>
        </div>
      </details>

      <details
        open={pageSettingsOpen || pageSettingsError}
        onToggle={(e) => {
          setPageSettingsOpen(e.currentTarget.open);
        }}
        className="rounded-md border border-slate-200 px-3 py-2"
      >
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Page settings{' '}
          <span className="font-normal text-slate-500">
            · {maxAgeDays} days old at most · {pageSize} per page · {maxPages}{' '}
            {Number(maxPages) === 1 ? 'page' : 'pages'}
          </span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field
            label="Max age (days)"
            htmlFor="sync-maxAgeDays"
            error={errors.maxAgeDays?.message}
          >
            <input
              inputMode="numeric"
              {...register('maxAgeDays')}
              {...a11y('maxAgeDays')}
              className={inputClass}
            />
          </Field>
          <Field
            label="Jobs per page"
            htmlFor="sync-pageSize"
            error={errors.pageSize?.message}
            hint="Free plan: max 25"
          >
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
      </details>

      <div className="flex items-start gap-2">
        <input
          id="sync-onlyNew"
          type="checkbox"
          {...register('onlyNew')}
          aria-describedby="sync-onlyNew-hint"
          className="mt-0.5 size-4 rounded border-slate-300 text-indigo-600"
        />
        <div className="text-sm">
          <label htmlFor="sync-onlyNew" className="font-medium text-slate-800">
            Only jobs new since my last import
          </label>
          <p id="sync-onlyNew-hint" className="text-slate-500">
            Skips postings this search already brought in. Untick to fetch everything again.
          </p>
        </div>
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
        <div
          role="status"
          className="space-y-1 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <p>
            {sync.data.resumed && 'Continued the last import. '}
            {sync.data.newSince && !sync.data.resumed
              ? `Looked for jobs found since ${formatDateTime(sync.data.newSince)}. `
              : ''}
            {sync.data.fetched === 0
              ? 'No new jobs this time.'
              : `Fetched ${plural(sync.data.fetched, 'job')}: ${sync.data.created} new` +
                (sync.data.updated > 0
                  ? `, ${sync.data.updated} already in your table (updated, not added twice).`
                  : '.')}
          </p>
          {sync.data.totalAvailable !== null && !sync.data.resumed && (
            <p>{plural(sync.data.totalAvailable, 'job')} match this search in total.</p>
          )}
          <p>
            Used {plural(sync.data.creditsCharged, 'credit')}
            {sync.data.jobsAlreadyPaid > 0 &&
              ` (${plural(sync.data.jobsAlreadyPaid, 'job')} already paid this month, so free)`}
            {sync.data.creditsRemaining !== null &&
              `, ${sync.data.creditsRemaining.toLocaleString()} left`}
            .
          </p>
        </div>
      )}
      {sync.data?.hasMore && lastInput && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>More jobs are waiting on the next pages.</p>
          <button
            type="button"
            disabled={sync.isPending}
            onClick={() => {
              sync.mutate({ ...lastInput, resume: true });
            }}
            className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Continue import (up to {plural(continueCredits, 'credit')})
          </button>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-200 pt-4">
        <Field
          label="Save this search as"
          htmlFor="save-name"
          error={nameError ?? undefined}
          hint="Run it again in one click from Saved searches"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="save-name"
              value={name}
              placeholder="e.g. Frontend in Berlin"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'save-name-error' : undefined}
              onChange={(e) => {
                setName(e.target.value);
              }}
              className={inputClass}
            />
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => {
                void onSave();
              }}
              className="shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              {updating ? 'Update saved search' : 'Save search'}
            </button>
          </div>
        </Field>
        {save.isError && (
          <p role="alert" className="text-sm text-red-700">
            Could not save: {getErrorMessage(save.error)}
          </p>
        )}
        {save.isSuccess && <p className="text-sm text-emerald-700">Saved "{save.data.name}".</p>}
      </div>
    </form>
  );
}
