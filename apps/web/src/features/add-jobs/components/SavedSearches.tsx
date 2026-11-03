import type { SavedSearch, ScheduleFrequency, SyncJobsResult } from '@jobsearch/data';
import {
  SCHEDULE_FREQUENCIES,
  useDeleteSavedSearch,
  useImportBudget,
  useRunSavedSearch,
  useSavedSearches,
  useSetSchedule,
} from '@jobsearch/data';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useJobFormat } from '../../jobs/useJobFormat';
import { countryName } from '../countries';
import { useDateTime } from '../format';

interface Props {
  /** Put a saved search into the import form to edit it. */
  onLoad: (search: SavedSearch) => void;
}

/** Your saved searches as cards: what they look for, how the last import went, and actions. */
export function SavedSearches({ onLoad }: Props) {
  const errorText = useErrorText();
  const { data: searches, isPending, error } = useSavedSearches();
  const { data: budget } = useImportBudget();
  const t = useTranslations('AddJobs');

  return (
    <section aria-labelledby="saved-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="saved-heading" className="text-lg font-semibold text-slate-900">
          {t('saved.heading')}
        </h2>
        {budget && (
          <p className="text-sm text-slate-600">
            {t('saved.budget', {
              used: budget.used,
              credits: t('credits', { count: budget.cap }),
            })}
          </p>
        )}
      </div>
      {isPending && <p className="text-sm text-slate-500">{t('saved.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t('saved.loadError', { error: errorText(error) })}
        </p>
      )}
      {searches?.length === 0 && <p className="text-sm text-slate-500">{t('saved.none')}</p>}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {searches?.map((search) => (
          <li key={search.id}>
            <SavedSearchCard search={search} onLoad={onLoad} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What a saved search looks for, in one line, in your language. */
function useDescribeSearch() {
  const t = useTranslations('AddJobs');
  const locale = useLocale();
  const f = useJobFormat();
  return (search: SavedSearch) => describeSearch(search, t, locale, f.language);
}

export function describeSearch(
  search: SavedSearch,
  t: (key: string, values?: Record<string, string | number>) => string,
  locale: string,
  languageName: (code: string) => string,
): string {
  const extras = [
    search.languages.length
      ? t('saved.inLanguages', { languages: search.languages.map(languageName).join('/') })
      : '',
    search.remoteOnly ? t('saved.remote') : '',
    search.skipFluentGerman ? t('saved.noFluentGerman') : '',
    search.employmentTypes.map((type) => t(`jobTypes.${type}`)).join(', '),
    search.excludeTitles.length
      ? t('saved.notTitles', { titles: search.excludeTitles.join(', ') })
      : '',
    search.minSalaryEur === null ? '' : t('saved.minSalary', { amount: search.minSalaryEur }),
  ];
  const countries = search.countryCodes.map((code) => countryName(code, locale));
  return [search.boards, search.titles, search.skills, countries, search.locations]
    .filter((part) => part.length > 0)
    .map((part) => part.join(', '))
    .concat(extras.filter(Boolean))
    .join(' · ');
}

function SavedSearchCard({ search, onLoad }: { search: SavedSearch; onLoad: Props['onLoad'] }) {
  const errorText = useErrorText();
  const run = useRunSavedSearch();
  const remove = useDeleteSavedSearch();
  const t = useTranslations('AddJobs');
  const dateTime = useDateTime();
  const describe = useDescribeSearch();
  const [confirming, setConfirming] = useState(false);
  const last = search.lastRun;
  const free = search.source !== 'JOBSPIPE';

  return (
    <article
      aria-labelledby={`saved-${search.id}`}
      className="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`saved-${search.id}`} className="font-medium text-slate-900">
            {search.name}
          </h3>
          {free && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
              {t(search.source === 'COMPANY_BOARDS' ? 'saved.boardsBadge' : 'saved.freeBadge')}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600">{describe(search)}</p>
        <p className="text-xs text-slate-500">
          {free
            ? t('saved.lastDaysFree', { days: search.maxAgeDays })
            : t('saved.lastDays', {
                days: search.maxAgeDays,
                credits: t('credits', { count: search.pageSize * search.maxPages }),
              })}
          {search.onlyNew ? t('saved.onlyNew') : ''}
        </p>
      </div>

      <p className="text-sm text-slate-700">
        {last
          ? t(last.creditsCharged === null || free ? 'saved.lastRun' : 'saved.lastRunCredits', {
              date: dateTime(last.finishedAt),
              created: last.created,
              updated: last.updated,
              credits: t('credits', { count: last.creditsCharged ?? 0 }),
            })
          : t('saved.never')}
      </p>

      <ScheduleControls search={search} />

      {run.data && <RunResult result={run.data} free={free} />}
      {run.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t('importFailed', { error: errorText(run.error) })}
        </p>
      )}
      {remove.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t('saved.deleteError', { error: errorText(remove.error) })}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <button
          type="button"
          disabled={run.isPending}
          onClick={() => {
            run.mutate({ id: search.id });
          }}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {run.isPending ? t('importing') : t('saved.runNow')}
        </button>
        {run.data?.hasMore && (
          <button
            type="button"
            disabled={run.isPending}
            onClick={() => {
              run.mutate({ id: search.id, resume: true });
            }}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {t('continue')}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onLoad(search);
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t('saved.edit')}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate(search.id);
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t('saved.deleteNamed', { name: search.name })}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
              }}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {t('saved.keep')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
            }}
            className="rounded-md px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            {t('saved.delete')}
          </button>
        )}
      </div>
    </article>
  );
}

function RunResult({ result, free }: { result: SyncJobsResult; free: boolean }) {
  const t = useTranslations('AddJobs');
  return (
    <div role="status" className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-800">
      <p>
        {result.resumed ? t('saved.continued') : t('saved.imported')}
        {result.fetched === 0
          ? t('saved.noNew')
          : t('saved.counts', { created: result.created, updated: result.updated })}{' '}
        {free
          ? t('saved.free')
          : t('saved.usedCredits', { credits: t('credits', { count: result.creditsCharged }) })}
        {result.hasMore && t('saved.morePages')}
      </p>
      {result.warnings.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-amber-900">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Pick how often the API imports this search by itself, and see what happened last time. */
function ScheduleControls({ search }: { search: SavedSearch }) {
  const errorText = useErrorText();
  const setSchedule = useSetSchedule();
  const t = useTranslations('AddJobs.saved');
  const dateTime = useDateTime();
  const [schedule, setFrequency] = useState(search.schedule);
  const [runAt, setRunAt] = useState(search.runAt);
  const changed = schedule !== search.schedule || runAt !== search.runAt;
  const id = `schedule-${search.id}`;

  return (
    <fieldset className="space-y-2 rounded-md bg-slate-50 p-3">
      <legend className="sr-only">{t('scheduleFor', { name: search.name })}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-600" htmlFor={`${id}-frequency`}>
            {t('runAuto')}
          </label>
          <select
            id={`${id}-frequency`}
            value={schedule}
            onChange={(event) => {
              setFrequency(event.target.value as ScheduleFrequency);
            }}
            className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
          >
            {SCHEDULE_FREQUENCIES.map((value) => (
              <option key={value} value={value}>
                {t(`frequency.${value}`)}
              </option>
            ))}
          </select>
        </div>
        {schedule !== 'OFF' && (
          <div>
            <label className="block text-xs text-slate-600" htmlFor={`${id}-time`}>
              {schedule === 'HOURLY' ? t('atMinute') : t('at')}
            </label>
            <input
              id={`${id}-time`}
              type="time"
              required
              value={runAt}
              onChange={(event) => {
                setRunAt(event.target.value);
              }}
              className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
            />
          </div>
        )}
        {changed && (
          <button
            type="button"
            disabled={setSchedule.isPending || runAt === ''}
            onClick={() => {
              setSchedule.mutate({ id: search.id, schedule, runAt });
            }}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {t('saveSchedule')}
          </button>
        )}
      </div>
      {search.schedule !== 'OFF' && search.nextRunAt && (
        <p className="text-xs text-slate-600">
          {t('nextRun', { date: dateTime(search.nextRunAt) })}
        </p>
      )}
      {search.scheduleNote && <p className="text-xs text-slate-600">{search.scheduleNote}</p>}
      {setSchedule.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t('scheduleError', { error: errorText(setSchedule.error) })}
        </p>
      )}
    </fieldset>
  );
}
