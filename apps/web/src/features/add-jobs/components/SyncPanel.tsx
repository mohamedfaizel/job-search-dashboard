import { zodResolver } from '@hookform/resolvers/zod';
import type { SavedSearch } from '@jobsearch/data';
import { EMPLOYMENT_TYPES, useMyProfile, useSaveSearch, useSyncJobs } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useErrorText } from '../../../i18n/useErrorText';
import { useJobFormat } from '../../jobs/useJobFormat';
import { useDateTime } from '../format';
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

/** The ad languages you can filter by, named in your language. */
const LANGUAGES = ['en', 'de'] as const;

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
  const errorText = useErrorText();
  const t = useTranslations('AddJobs');
  const f = useJobFormat();
  const dateTime = useDateTime();
  const schema = useMemo(() => syncFormSchema((key, values) => t(`errors.${key}`, values)), [t]);
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
    resolver: zodResolver(schema),
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
      setNameError(t('errors.name'));
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
          {t('sync.heading')}
        </h2>
        <p className="text-sm text-slate-600">{t('sync.intro')}</p>
      </div>

      {hasProfile && (
        <button
          type="button"
          onClick={fillFromProfile}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t('sync.fillProfile')}
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          label={t('sync.titles')}
          htmlFor="sync-titles"
          error={errors.titles?.message}
          hint={t('sync.commaSeparated')}
          required
        >
          <input {...register('titles')} {...a11y('titles')} className={inputClass} />
        </Field>
        <Field label={t('sync.skills')} htmlFor="sync-skills" hint={t('sync.skillsHint')}>
          <input {...register('skills')} {...a11y('skills')} className={inputClass} />
        </Field>
        <Field
          label={t('sync.countries')}
          htmlFor="sync-countryCodes"
          error={errors.countryCodes?.message}
          hint={t('sync.countriesHint')}
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
        <Field label={t('sync.locations')} htmlFor="sync-locations" hint={t('sync.locationsHint')}>
          <input {...register('locations')} {...a11y('locations')} className={inputClass} />
        </Field>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <details
          open={moreOpen || moreError}
          onToggle={(e) => {
            setMoreOpen(e.currentTarget.open);
          }}
          className="rounded-md border border-slate-200 px-3 py-2"
        >
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            {t('sync.moreFilters')}{' '}
            {activeFilters > 0 && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                {t('sync.filtersOn', { count: activeFilters })}
              </span>
            )}
          </summary>
          <div className="mt-3 space-y-4">
            <Controller
              control={control}
              name="languages"
              render={({ field }) => (
                <fieldset className="space-y-1">
                  <legend className="text-sm font-medium text-slate-700">
                    {t('sync.adLanguage')}
                  </legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {LANGUAGES.map((code) => (
                      <label key={code} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={field.value.includes(code)}
                          onChange={() => {
                            field.onChange(toggle(field.value, code));
                          }}
                          className={CHECKBOX}
                        />
                        {f.language(code)}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{t('sync.languagesHint')}</p>
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
                  <span className="font-medium text-slate-800">{t('sync.skipGerman')}</span>
                  <span className="block text-xs text-slate-500">{t('sync.skipGermanHint')}</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register('remoteOnly')}
                  className={`mt-0.5 ${CHECKBOX}`}
                />
                <span className="font-medium text-slate-800">{t('sync.remoteOnly')}</span>
              </label>
            </div>

            <Field
              label={t('sync.excludeTitles')}
              htmlFor="sync-excludeTitles"
              hint={t('sync.excludeHint')}
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
                  <legend className="text-sm font-medium text-slate-700">
                    {t('sync.jobType')}
                  </legend>
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
                        {t(`jobTypes.${type}`)}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{t('sync.jobTypeHint')}</p>
                </fieldset>
              )}
            />

            <Field
              label={t('sync.minSalary')}
              htmlFor="sync-minSalaryEur"
              error={errors.minSalaryEur?.message}
              hint={t('sync.minSalaryHint')}
            >
              <input
                inputMode="numeric"
                placeholder={t('sync.minSalaryPlaceholder')}
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
            {t('sync.pageSettings')}{' '}
            <span className="font-normal text-slate-500">
              {t('sync.pageSummary', {
                days: maxAgeDays,
                size: pageSize,
                pages: Number(maxPages) || 0,
              })}
            </span>
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field
              label={t('sync.maxAge')}
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
              label={t('sync.pageSize')}
              htmlFor="sync-pageSize"
              error={errors.pageSize?.message}
              hint={t('sync.pageSizeHint')}
            >
              <input
                inputMode="numeric"
                {...register('pageSize')}
                {...a11y('pageSize')}
                className={inputClass}
              />
            </Field>
            <Field
              label={t('sync.maxPages')}
              htmlFor="sync-maxPages"
              error={errors.maxPages?.message}
            >
              <input
                inputMode="numeric"
                {...register('maxPages')}
                {...a11y('maxPages')}
                className={inputClass}
              />
            </Field>
          </div>
        </details>
      </div>

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
            {t('sync.onlyNew')}
          </label>
          <p id="sync-onlyNew-hint" className="text-slate-500">
            {t('sync.onlyNewHint')}
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={sync.isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {sync.isPending
          ? t('importing')
          : Number.isFinite(maxCredits)
            ? t('sync.importUpTo', { count: maxCredits })
            : t('sync.import')}
      </button>

      {sync.isError && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {t('importFailed', { error: errorText(sync.error) })}
        </p>
      )}
      {sync.data && (
        <div
          role="status"
          className="space-y-1 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <p>
            {sync.data.resumed && t('sync.resumed')}
            {sync.data.newSince && !sync.data.resumed
              ? t('sync.since', { date: dateTime(sync.data.newSince) })
              : ''}
            {sync.data.fetched === 0
              ? t('sync.noNew')
              : t(sync.data.updated > 0 ? 'sync.fetchedUpdated' : 'sync.fetched', {
                  jobs: t('jobs', { count: sync.data.fetched }),
                  created: sync.data.created,
                  updated: sync.data.updated,
                })}
          </p>
          {sync.data.totalAvailable !== null && !sync.data.resumed && (
            <p>{t('sync.total', { jobs: t('jobs', { count: sync.data.totalAvailable }) })}</p>
          )}
          <p>
            {t('sync.used', { credits: t('credits', { count: sync.data.creditsCharged }) })}
            {sync.data.jobsAlreadyPaid > 0 &&
              t('sync.alreadyPaid', { jobs: t('jobs', { count: sync.data.jobsAlreadyPaid }) })}
            {sync.data.creditsRemaining !== null &&
              t('sync.left', { count: sync.data.creditsRemaining })}
            .
          </p>
        </div>
      )}
      {sync.data?.hasMore && lastInput && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{t('sync.moreWaiting')}</p>
          <button
            type="button"
            disabled={sync.isPending}
            onClick={() => {
              sync.mutate({ ...lastInput, resume: true });
            }}
            className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {t('sync.continueUpTo', { credits: t('credits', { count: continueCredits }) })}
          </button>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-200 pt-4">
        <Field
          label={t('sync.saveAs')}
          htmlFor="save-name"
          error={nameError ?? undefined}
          hint={t('sync.saveAsHint')}
          className="max-w-2xl"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="save-name"
              value={name}
              placeholder={t('sync.namePlaceholder')}
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
              {updating ? t('sync.update') : t('sync.save')}
            </button>
          </div>
        </Field>
        {save.isError && (
          <p role="alert" className="text-sm text-red-700">
            {t('sync.saveError', { error: errorText(save.error) })}
          </p>
        )}
        {save.isSuccess && (
          <p className="text-sm text-emerald-700">{t('sync.saved', { name: save.data.name })}</p>
        )}
      </div>
    </form>
  );
}
