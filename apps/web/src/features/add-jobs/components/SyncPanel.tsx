import { zodResolver } from '@hookform/resolvers/zod';
import type { SavedSearch } from '@jobsearch/data';
import {
  EMPLOYMENT_TYPES,
  IMPORT_SOURCES,
  useMyApiKeys,
  useMyProfile,
  useSaveSearch,
  useSyncJobs,
} from '@jobsearch/data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { InfoTip } from '../../../components/InfoTip';
import { useErrorText } from '../../../i18n/useErrorText';
import { useJobFormat } from '../../jobs/useJobFormat';
import { CompanyPicker } from '../catalog/CompanyPicker';
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
import { ChipCheckbox, Field, GROUP_LABEL, inputClass } from './Field';

/** The ad languages you can filter by, named in your language. */
const LANGUAGES = ['en', 'de'] as const;

/** The chips of one group, wrapping onto more lines when they don't fit. */
const CHIP_ROW = 'flex flex-wrap items-center gap-1.5';

/** Adds a value to a list, or takes it out. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface Props {
  /** A saved search to start from. Saving with the same name updates it. */
  loaded?: SavedSearch | null;
}

/**
 * Pull fresh postings into the database, and save searches to reuse. Kept short: help texts sit
 * behind ⓘ, on/off filters are chips, the page settings fold into one button, and Save and
 * Import share one bar at the bottom.
 */
export function SyncPanel({ loaded = null }: Props) {
  const errorText = useErrorText();
  const t = useTranslations('AddJobs');
  const f = useJobFormat();
  const dateTime = useDateTime();
  const languagesId = useId();
  const typesId = useId();
  const filtersId = useId();
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

  const source = useWatch({ control, name: 'source' });
  // No JobHunter token yet: start on the Arbeitsagentur instead, once, and say why.
  const keys = useMyApiKeys();
  const noToken = keys.isSuccess && !keys.data.some((key) => key.kind === 'JOBHUNTER');
  const pickedNoCredits = useRef(false);
  useEffect(() => {
    if (!noToken || loaded || pickedNoCredits.current) return;
    pickedNoCredits.current = true;
    setValue('source', 'ARBEITSAGENTUR');
  }, [noToken, loaded, setValue]);
  // Arbeitsagentur and company pages: no credits, and only some of the filters apply.
  const noCredits = source !== 'JOBHUNTER';
  const boards = source === 'COMPANY_BOARDS';
  const boardsText = useWatch({ control, name: 'boards' });
  const [pageSize, maxPages, maxAgeDays] = useWatch({
    control,
    name: ['pageSize', 'maxPages', 'maxAgeDays'],
  });
  const maxCredits = Number(pageSize) * Number(maxPages);

  // The page settings fold into one button to keep the form short; a mistake in them opens it.
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
      className="rounded-lg border border-slate-200 bg-white"
    >
      <div className="space-y-3 p-3 sm:p-4">
        <h2 id="sync-heading" className="sr-only">
          {t(boards ? 'sync.headingBoards' : noCredits ? 'sync.headingFree' : 'sync.heading')}
        </h2>

        <fieldset className="space-y-2">
          <legend className="sr-only">{t('sync.source')}</legend>
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className={GROUP_LABEL}>
                {t('sync.source')}
              </span>
              <InfoTip
                label={t('moreAbout', { field: t('sync.source') })}
                text={t(boards ? 'sync.introBoards' : noCredits ? 'sync.introFree' : 'sync.intro')}
              />
            </div>
            {hasProfile && (
              <button
                type="button"
                onClick={fillFromProfile}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-3.5"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                </svg>
                {t('sync.fillProfile')}
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {IMPORT_SOURCES.map((value) => (
              <label
                key={value}
                className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500"
              >
                <input
                  type="radio"
                  value={value}
                  {...register('source')}
                  className="size-3.5 border-slate-300 text-slate-900"
                />
                <span className="leading-tight">
                  <span className="block font-semibold text-slate-900">
                    {t(`sync.sources.${value}.name`)}
                  </span>
                  <span className="block text-[11px] text-slate-600">
                    {t(`sync.sources.${value}.hint`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {noToken && (
          <p className="text-xs text-slate-600">
            {t(source === 'JOBHUNTER' ? 'sync.noToken.picked' : 'sync.noToken.other')}{' '}
            <Link href="/settings" className="font-medium underline">
              {t('sync.noToken.link')}
            </Link>
          </p>
        )}

        {boards && (
          <div className="space-y-2">
            <Field
              label={t('sync.boards')}
              htmlFor="sync-boards"
              error={errors.boards?.message}
              tip={t('sync.boardsHint')}
              required
            >
              <input
                placeholder={t('sync.boardsPlaceholder')}
                {...register('boards')}
                {...a11y('boards')}
                className={inputClass}
              />
            </Field>
            <CompanyPicker
              value={boardsText}
              onChange={(text) => {
                setValue('boards', text, { shouldValidate: Boolean(errors.boards) });
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field
            label={t('sync.titles')}
            htmlFor="sync-titles"
            error={errors.titles?.message}
            tip={t('sync.commaSeparated')}
            required
            className="col-span-2 lg:col-span-1"
          >
            <input {...register('titles')} {...a11y('titles')} className={inputClass} />
          </Field>
          {!noCredits && (
            <Field label={t('sync.skills')} htmlFor="sync-skills" tip={t('sync.skillsHint')}>
              <input {...register('skills')} {...a11y('skills')} className={inputClass} />
            </Field>
          )}
          {!noCredits && (
            <Field
              label={t('sync.countries')}
              htmlFor="sync-countryCodes"
              error={errors.countryCodes?.message}
              tip={t('sync.countriesHint')}
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
          )}
          <Field
            label={t('sync.locations')}
            htmlFor="sync-locations"
            tip={t('sync.locationsHint')}
            className="col-span-2 lg:col-span-1"
          >
            <input
              placeholder={t('sync.locationsPlaceholder')}
              {...register('locations')}
              {...a11y('locations')}
              className={inputClass}
            />
          </Field>
        </div>

        {/* One row per group: the name in a fixed column, its chips beside it, so they line up. */}
        <div className="grid gap-x-3 gap-y-2 rounded-md border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
          {!noCredits && (
            <Controller
              control={control}
              name="languages"
              render={({ field }) => (
                <>
                  <div className="flex items-center gap-1">
                    <span id={languagesId} className={GROUP_LABEL}>
                      {t('sync.adLanguage')}
                    </span>
                    <InfoTip
                      label={t('moreAbout', { field: t('sync.adLanguage') })}
                      text={t('sync.languagesHint')}
                    />
                  </div>
                  <div role="group" aria-labelledby={languagesId} className={CHIP_ROW}>
                    {LANGUAGES.map((code) => (
                      <ChipCheckbox
                        key={code}
                        label={f.language(code)}
                        checked={field.value.includes(code)}
                        onChange={() => {
                          field.onChange(toggle(field.value, code));
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            />
          )}
          <Controller
            control={control}
            name="employmentTypes"
            render={({ field }) => (
              <>
                <div className="flex items-center gap-1">
                  <span id={typesId} className={GROUP_LABEL}>
                    {t('sync.jobType')}
                  </span>
                  <InfoTip
                    label={t('moreAbout', { field: t('sync.jobType') })}
                    text={t('sync.jobTypeHint')}
                  />
                </div>
                <div role="group" aria-labelledby={typesId} className={CHIP_ROW}>
                  {EMPLOYMENT_TYPES.filter(
                    (type) =>
                      source !== 'ARBEITSAGENTUR' || type === 'full-time' || type === 'part-time',
                  ).map((type) => (
                    <ChipCheckbox
                      key={type}
                      label={t(`jobTypes.${type}`)}
                      checked={field.value.includes(type)}
                      onChange={() => {
                        field.onChange(toggle(field.value, type));
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          />
          <span id={filtersId} className={GROUP_LABEL}>
            {t('sync.filters')}
          </span>
          <div role="group" aria-labelledby={filtersId} className={CHIP_ROW}>
            <ChipCheckbox label={t('sync.remoteOnly')} {...register('remoteOnly')} />
            {!boards && (
              <span className="inline-flex items-center gap-1">
                <ChipCheckbox label={t('sync.onlyNew')} {...register('onlyNew')} />
                <InfoTip
                  label={t('moreAbout', { field: t('sync.onlyNew') })}
                  text={t('sync.onlyNewHint')}
                />
              </span>
            )}
            {!noCredits && (
              <span className="inline-flex items-center gap-1">
                <ChipCheckbox label={t('sync.skipGerman')} {...register('skipFluentGerman')} />
                <InfoTip
                  label={t('moreAbout', { field: t('sync.skipGerman') })}
                  text={t('sync.skipGermanHint')}
                />
              </span>
            )}
          </div>
        </div>

        {/* Skip titles, min salary and the page settings share one 12-column row. */}
        <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
          <Field
            label={t('sync.excludeTitles')}
            htmlFor="sync-excludeTitles"
            tip={t('sync.excludeHint')}
            className={noCredits ? 'sm:col-span-8' : 'sm:col-span-5'}
          >
            <input
              placeholder={t('sync.excludePlaceholder')}
              {...register('excludeTitles')}
              {...a11y('excludeTitles')}
              className={inputClass}
            />
          </Field>
          {!noCredits && (
            <Field
              label={t('sync.minSalary')}
              htmlFor="sync-minSalaryEur"
              error={errors.minSalaryEur?.message}
              tip={t('sync.minSalaryHint')}
              className="sm:col-span-3"
            >
              <input
                inputMode="numeric"
                placeholder={t('sync.minSalaryPlaceholder')}
                {...register('minSalaryEur')}
                {...a11y('minSalaryEur')}
                className={inputClass}
              />
            </Field>
          )}
          <details
            open={pageSettingsOpen || pageSettingsError}
            onToggle={(e) => {
              setPageSettingsOpen(e.currentTarget.open);
            }}
            className="group relative sm:col-span-4"
          >
            <summary className="flex h-[34px] w-full cursor-pointer list-none items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:border-slate-500 [&::-webkit-details-marker]:hidden">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-3.5"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
              </svg>
              <span className="sr-only">{t('sync.pageSettings')}</span>
              {boards
                ? t('sync.pageSummaryBoards', { days: maxAgeDays })
                : t('sync.pageSummary', {
                    days: maxAgeDays,
                    size: pageSize,
                    pages: Number(maxPages) || 0,
                  })}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-3.5 transition-transform group-open:rotate-180"
              >
                <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </summary>
            <div className="absolute right-0 z-30 mt-1 grid w-72 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg sm:w-96 sm:grid-cols-3">
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
              {!boards && (
                <>
                  <Field
                    label={t('sync.pageSize')}
                    htmlFor="sync-pageSize"
                    error={errors.pageSize?.message}
                    tip={t('sync.pageSizeHint')}
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
                </>
              )}
            </div>
          </details>
        </div>

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
            {lastInput?.source && lastInput.source !== 'JOBHUNTER' ? (
              <p>{t('sync.usedFree')}</p>
            ) : (
              <p>
                {t('sync.used', { credits: t('credits', { count: sync.data.creditsCharged }) })}
                {sync.data.jobsAlreadyPaid > 0 &&
                  t('sync.alreadyPaid', { jobs: t('jobs', { count: sync.data.jobsAlreadyPaid }) })}
                {sync.data.creditsRemaining !== null &&
                  t('sync.left', { count: sync.data.creditsRemaining })}
                .
              </p>
            )}
            {sync.data.warnings.length > 0 && (
              <div className="text-amber-900">
                <p className="font-medium">{t('sync.warnings')}</p>
                <ul className="list-disc pl-5">
                  {sync.data.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {sync.data?.hasMore && lastInput && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{t('sync.moreWaiting')}</p>
            <button
              type="button"
              disabled={sync.isPending}
              onClick={() => {
                sync.mutate({ ...lastInput, resume: true });
              }}
              className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {lastInput.source && lastInput.source !== 'JOBHUNTER'
                ? t('sync.continueFree')
                : t('sync.continueUpTo', { credits: t('credits', { count: continueCredits }) })}
            </button>
          </div>
        )}
      </div>

      {/* Save and Import stay in sight at the bottom of the screen while the form scrolls. */}
      <div className="sticky bottom-[var(--tabbar)] z-20 space-y-1 rounded-b-lg border-t border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="save-name"
            className="sr-only text-xs font-semibold text-slate-700 sm:not-sr-only"
          >
            {t('sync.saveAs')}
          </label>
          <span className="hidden sm:inline-flex">
            <InfoTip
              label={t('moreAbout', { field: t('sync.saveAs') })}
              text={t('sync.saveAsHint')}
            />
          </span>
          <input
            id="save-name"
            value={name}
            placeholder={t('sync.namePlaceholder')}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'save-name-error' : undefined}
            onChange={(e) => {
              setName(e.target.value);
            }}
            className="block h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-sm aria-[invalid=true]:border-red-500 sm:w-56 sm:flex-none"
          />
          <button
            type="button"
            disabled={save.isPending}
            aria-label={updating ? t('sync.update') : t('sync.save')}
            title={updating ? t('sync.update') : t('sync.save')}
            onClick={() => {
              void onSave();
            }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-brand-400 bg-brand-50 px-3 text-xs font-semibold text-slate-900 hover:bg-brand-100 disabled:opacity-50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-3.5"
            >
              <path d="M6 3h12v18l-6-4-6 4z" />
            </svg>
            <span className="hidden sm:inline">{updating ? t('sync.update') : t('sync.save')}</span>
          </button>
          <button
            type="submit"
            disabled={sync.isPending}
            className="inline-flex h-9 basis-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 sm:ml-auto sm:basis-auto"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-4"
            >
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            {sync.isPending
              ? t('importing')
              : Number.isFinite(maxCredits) && !noCredits
                ? t('sync.importUpTo', { count: maxCredits })
                : t('sync.import')}
          </button>
        </div>
        {nameError && (
          <p id="save-name-error" role="alert" className="text-xs text-red-700">
            {nameError}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="text-xs text-red-700">
            {t('sync.saveError', { error: errorText(save.error) })}
          </p>
        )}
        {save.isSuccess && (
          <p className="text-xs text-emerald-700">{t('sync.saved', { name: save.data.name })}</p>
        )}
      </div>
    </form>
  );
}
