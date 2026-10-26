import type { SavedSearch, SyncJobsResult } from '@jobsearch/data';
import {
  getErrorMessage,
  useDeleteSavedSearch,
  useRunSavedSearch,
  useSavedSearches,
} from '@jobsearch/data';
import { useState } from 'react';
import { formatDateTime, plural } from '../format';

interface Props {
  /** Put a saved search into the import form to edit it. */
  onLoad: (search: SavedSearch) => void;
}

/** Your saved searches as cards: what they look for, how the last import went, and actions. */
export function SavedSearches({ onLoad }: Props) {
  const { data: searches, isPending, error } = useSavedSearches();

  return (
    <section aria-labelledby="saved-heading" className="space-y-3">
      <h2 id="saved-heading" className="text-lg font-semibold text-slate-900">
        Saved searches
      </h2>
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

export function describeSearch(search: SavedSearch): string {
  return [search.titles, search.skills, search.countryCodes, search.locations]
    .filter((part) => part.length > 0)
    .map((part) => part.join(', '))
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
