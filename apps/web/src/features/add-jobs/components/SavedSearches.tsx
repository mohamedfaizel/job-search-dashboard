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
import { useWarningText } from '../useWarningText';
import { AutopilotControls } from './AutopilotControls';

interface Props {
  /** Put a saved search into the import form to edit it. */
  onLoad: (search: SavedSearch) => void;
  /** The search that is in the form now, marked in the list. */
  loadedId?: number | null;
}

/**
 * Your saved searches as a compact panel beside the import form: one row each with Run, Edit and
 * a "more" fold for the schedule and Delete. On a phone it sits above the form and can be hidden.
 */
export function SavedSearches({ onLoad, loadedId = null }: Props) {
  const errorText = useErrorText();
  const { data: searches, isPending, error } = useSavedSearches();
  const { data: budget } = useImportBudget();
  const t = useTranslations('AddJobs');
  const [hidden, setHidden] = useState(false);
  const empty = searches?.length === 0;

  return (
    <section
      aria-labelledby="saved-heading"
      className={`space-y-2 rounded-lg border bg-white p-3 ${
        empty ? 'border-dashed border-slate-400' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="saved-heading" className="text-sm font-semibold text-slate-900">
          {searches?.length ? t('saved.count', { count: searches.length }) : t('saved.heading')}
        </h2>
        {!empty && (
          <button
            type="button"
            aria-expanded={!hidden}
            aria-controls="saved-list"
            onClick={() => {
              setHidden((h) => !h);
            }}
            className="min-h-11 px-2 text-xs text-slate-700 lg:hidden"
          >
            {hidden ? t('saved.show') : t('saved.hide')}
          </button>
        )}
      </div>
      {isPending && <p className="text-sm text-slate-600">{t('saved.loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t('saved.loadError', { error: errorText(error) })}
        </p>
      )}
      {empty && <p className="text-sm text-slate-700">{t('saved.none')}</p>}
      <div id="saved-list" className={hidden ? 'hidden lg:block' : undefined}>
        {budget && !empty && (
          <p className="mb-2 text-xs text-slate-600">
            {t('saved.budget', {
              used: budget.used,
              credits: t('credits', { count: budget.cap }),
            })}
          </p>
        )}
        <ul className="space-y-2">
          {searches?.map((search) => (
            <li key={search.id}>
              <SavedSearchRow search={search} onLoad={onLoad} loaded={search.id === loadedId} />
            </li>
          ))}
        </ul>
      </div>
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

function describeSearch(
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

function SavedSearchRow({
  search,
  onLoad,
  loaded,
}: {
  search: SavedSearch;
  onLoad: Props['onLoad'];
  loaded: boolean;
}) {
  const errorText = useErrorText();
  const run = useRunSavedSearch();
  const remove = useDeleteSavedSearch();
  const t = useTranslations('AddJobs');
  const dateTime = useDateTime();
  const describe = useDescribeSearch();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const last = search.lastRun;
  const free = search.source !== 'JOBHUNTER';
  const moreId = `saved-more-${search.id}`;

  return (
    <article
      aria-labelledby={`saved-${search.id}`}
      className={`space-y-1.5 rounded-md border p-2.5 ${
        loaded ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <h3
          id={`saved-${search.id}`}
          className="min-w-0 flex-1 text-sm font-semibold text-slate-900"
        >
          {search.name}
        </h3>
        {loaded && <span className="text-xs text-brand-800">{t('saved.loadedNote')}</span>}
        {search.autopilot && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            {t('saved.autopilotBadge')}
          </span>
        )}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {t(`saved.frequency.${search.schedule}`)}
        </span>
      </div>
      <p className="line-clamp-2 text-xs text-slate-600">
        {free && (
          <>
            <span className="font-medium text-emerald-800">
              {t(search.source === 'COMPANY_BOARDS' ? 'saved.boardsBadge' : 'saved.freeBadge')}
            </span>
            {' · '}
          </>
        )}
        {describe(search)}
      </p>
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 truncate text-xs text-slate-600">
          {last
            ? t(last.creditsCharged === null || free ? 'saved.lastRun' : 'saved.lastRunCredits', {
                date: dateTime(last.finishedAt),
                created: last.created,
                updated: last.updated,
                credits: t('credits', { count: last.creditsCharged ?? 0 }),
              })
            : t('saved.never')}
        </p>
        <button
          type="button"
          disabled={run.isPending}
          onClick={() => {
            run.mutate({ id: search.id });
          }}
          className="min-h-8 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {run.isPending ? t('importing') : t('saved.runNow')}
        </button>
        <button
          type="button"
          aria-label={t('saved.editNamed', { name: search.name })}
          title={t('saved.edit')}
          onClick={() => {
            onLoad(search);
          }}
          className="flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 20h4L19 9l-4-4L4 16z" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={t('saved.more', { name: search.name })}
          aria-expanded={open}
          aria-controls={moreId}
          onClick={() => {
            setOpen((o) => !o);
          }}
          className="flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {run.data && <RunResult result={run.data} free={free} />}
      {run.data?.hasMore && (
        <button
          type="button"
          disabled={run.isPending}
          onClick={() => {
            run.mutate({ id: search.id, resume: true });
          }}
          className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {t('continue')}
        </button>
      )}
      {run.isError && (
        <p role="alert" className="text-xs text-red-700">
          {t('importFailed', { error: errorText(run.error) })}
        </p>
      )}

      <div id={moreId} hidden={!open} className="space-y-2 border-t border-slate-200 pt-2">
        <p className="text-xs text-slate-600">
          {free
            ? t('saved.lastDaysFree', { days: search.maxAgeDays })
            : t('saved.lastDays', {
                days: search.maxAgeDays,
                credits: t('credits', { count: search.pageSize * search.maxPages }),
              })}
          {search.onlyNew ? t('saved.onlyNew') : ''}
        </p>
        <ScheduleControls search={search} />
        <AutopilotControls search={search} />
        {remove.isError && (
          <p role="alert" className="text-xs text-red-700">
            {t('saved.deleteError', { error: errorText(remove.error) })}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {confirming ? (
            <>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(search.id);
                }}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t('saved.deleteNamed', { name: search.name })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                }}
                className="rounded-md px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
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
              className="rounded-md px-3 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              {t('saved.delete')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function RunResult({ result, free }: { result: SyncJobsResult; free: boolean }) {
  const t = useTranslations('AddJobs');
  const warningText = useWarningText();
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
            <li key={warning}>{warningText(warning)}</li>
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
