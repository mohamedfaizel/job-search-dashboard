import type { SavedSearch, ScheduleFrequency, SyncJobsResult } from '@jobsearch/data';
import {
  getErrorMessage,
  SCHEDULE_FREQUENCIES,
  useDeleteSavedSearch,
  useImportBudget,
  useRunSavedSearch,
  useSavedSearches,
  useSetSchedule,
} from '@jobsearch/data';
import { useState } from 'react';
import { countryName } from '../countries';
import { formatDateTime, plural } from '../format';

interface Props {
  /** Put a saved search into the import form to edit it. */
  onLoad: (search: SavedSearch) => void;
}

/** Your saved searches as cards: what they look for, how the last import went, and actions. */
export function SavedSearches({ onLoad }: Props) {
  const { data: searches, isPending, error } = useSavedSearches();
  const { data: budget } = useImportBudget();

  return (
    <section aria-labelledby="saved-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="saved-heading" className="text-lg font-semibold text-slate-900">
          Saved searches
        </h2>
        {budget && (
          <p className="text-sm text-slate-600">
            Today: {budget.used} of {plural(budget.cap, 'credit')} used. Scheduled imports stop
            before going over.
          </p>
        )}
      </div>
      {isPending && <p className="text-sm text-slate-500">Loading saved searches…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Could not load saved searches: {getErrorMessage(error)}
        </p>
      )}
      {searches?.length === 0 && (
        <p className="text-sm text-slate-500">
          None yet. Fill in the import form and use "Save search".
        </p>
      )}
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

/** "en" → "English", for the search summary. */
function languageName(code: string): string {
  return (
    ({ en: 'English', de: 'German' } as Record<string, string | undefined>)[code] ??
    code.toUpperCase()
  );
}

export function describeSearch(search: SavedSearch): string {
  const extras = [
    search.languages.length ? `in ${search.languages.map(languageName).join('/')}` : '',
    search.remoteOnly ? 'remote' : '',
    search.skipFluentGerman ? 'no fluent German' : '',
    search.employmentTypes.join(', '),
    search.excludeTitles.length ? `not ${search.excludeTitles.join(', ')}` : '',
    search.minSalaryEur === null ? '' : `€${search.minSalaryEur.toLocaleString('en')}+`,
  ];
  return [search.titles, search.skills, search.countryCodes.map(countryName), search.locations]
    .filter((part) => part.length > 0)
    .map((part) => part.join(', '))
    .concat(extras.filter(Boolean))
    .join(' · ');
}

function SavedSearchCard({ search, onLoad }: { search: SavedSearch; onLoad: Props['onLoad'] }) {
  const run = useRunSavedSearch();
  const remove = useDeleteSavedSearch();
  const [confirming, setConfirming] = useState(false);
  const last = search.lastRun;

  return (
    <article
      aria-labelledby={`saved-${search.id}`}
      className="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div>
        <h3 id={`saved-${search.id}`} className="font-medium text-slate-900">
          {search.name}
        </h3>
        <p className="text-sm text-slate-600">{describeSearch(search)}</p>
        <p className="text-xs text-slate-500">
          Last {search.maxAgeDays} days · up to{' '}
          {plural(search.pageSize * search.maxPages, 'credit')} per run
          {search.onlyNew ? ' · only new jobs' : ''}
        </p>
      </div>

      <p className="text-sm text-slate-700">
        {last
          ? `Last run ${formatDateTime(last.finishedAt)}: ${last.created} new, ${last.updated} already saved${
              last.creditsCharged === null ? '' : `, ${plural(last.creditsCharged, 'credit')}`
            }.`
          : 'Never run.'}
      </p>

      <ScheduleControls search={search} />

      {run.data && <RunResult result={run.data} />}
      {run.isError && (
        <p role="alert" className="text-sm text-red-700">
          Import failed: {getErrorMessage(run.error)}
        </p>
      )}
      {remove.isError && (
        <p role="alert" className="text-sm text-red-700">
          Could not delete: {getErrorMessage(remove.error)}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <button
          type="button"
          disabled={run.isPending}
          onClick={() => {
            run.mutate({ id: search.id });
          }}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {run.isPending ? 'Importing…' : 'Run now'}
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
            Continue import
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onLoad(search);
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Edit
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
              Delete "{search.name}"
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
              }}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Keep
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
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

function RunResult({ result }: { result: SyncJobsResult }) {
  return (
    <p role="status" className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-800">
      {result.resumed ? 'Continued: ' : 'Imported: '}
      {result.fetched === 0
        ? 'no new jobs this time.'
        : `${result.created} new, ${result.updated} already in your table.`}{' '}
      Used {plural(result.creditsCharged, 'credit')}.{result.hasMore && ' More pages are waiting.'}
    </p>
  );
}

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  OFF: 'Off',
  HOURLY: 'Every hour',
  DAILY: 'Every day',
  WEEKDAYS: 'Weekdays (Mon–Fri)',
};

/** Pick how often the API imports this search by itself, and see what happened last time. */
function ScheduleControls({ search }: { search: SavedSearch }) {
  const setSchedule = useSetSchedule();
  const [schedule, setFrequency] = useState(search.schedule);
  const [runAt, setRunAt] = useState(search.runAt);
  const changed = schedule !== search.schedule || runAt !== search.runAt;
  const id = `schedule-${search.id}`;

  return (
    <fieldset className="space-y-2 rounded-md bg-slate-50 p-3">
      <legend className="sr-only">Schedule for {search.name}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-600" htmlFor={`${id}-frequency`}>
            Run automatically
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
                {FREQUENCY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {schedule !== 'OFF' && (
          <div>
            <label className="block text-xs text-slate-600" htmlFor={`${id}-time`}>
              {schedule === 'HOURLY' ? 'At minute of' : 'At'}
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
            Save schedule
          </button>
        )}
      </div>
      {search.schedule !== 'OFF' && search.nextRunAt && (
        <p className="text-xs text-slate-600">Next run: {formatDateTime(search.nextRunAt)}</p>
      )}
      {search.scheduleNote && <p className="text-xs text-slate-600">{search.scheduleNote}</p>}
      {setSchedule.isError && (
        <p role="alert" className="text-sm text-red-700">
          Could not save the schedule: {getErrorMessage(setSchedule.error)}
        </p>
      )}
    </fieldset>
  );
}
