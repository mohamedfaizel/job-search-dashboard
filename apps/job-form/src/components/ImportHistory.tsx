import { getErrorMessage, useSyncRuns } from '@jobsearch/data';
import { formatDateTime } from '../format';

/** Every import, newest first: what was searched and what it brought in. */
export function ImportHistory() {
  const { data: runs, isPending, error } = useSyncRuns(20);

  return (
    <section aria-labelledby="history-heading" className="space-y-3">
      <h2 id="history-heading" className="text-lg font-semibold text-slate-900">
        Import history
      </h2>
      {isPending && <p className="text-sm text-slate-500">Loading import history…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Could not load import history: {getErrorMessage(error)}
        </p>
      )}
      {runs?.length === 0 && <p className="text-sm text-slate-500">No imports yet.</p>}
      {runs && runs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">The last 20 imports from JobsPipe</caption>
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  When
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Search
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  New
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Already saved
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Credits
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Pages
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-slate-100 text-slate-700">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(run.finishedAt)}</td>
                  <td className="px-3 py-2">
                    {run.savedSearchName && (
                      <span className="font-medium text-slate-900">{run.savedSearchName}: </span>
                    )}
                    {run.summary}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{run.created}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{run.updated}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{run.creditsCharged ?? '–'}</td>
                  <td className="px-3 py-2">
                    {run.complete ? (
                      'All fetched'
                    ) : (
                      <span className="text-amber-700">More left</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
