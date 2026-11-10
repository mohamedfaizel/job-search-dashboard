import type { ImportSource, SyncRun } from '@jobsearch/data';
import { useSyncRuns } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useDateTime } from '../format';

/** How many imports show before "Show more". */
const FIRST_ROWS = 8;

/**
 * On phones each import is a short card: the date, then the search, then the numbers on one
 * line, each with its column name (from data-label) in front. Wider screens get the normal table.
 */
const LINE = 'block px-3 sm:table-cell sm:py-1.5';
const COUNT =
  'inline-flex gap-1 pl-3 tabular-nums before:text-slate-500 before:content-[attr(data-label)] sm:table-cell sm:py-1.5 sm:pl-3 sm:pr-3 sm:text-right sm:before:content-none';

const SOURCE_TAG: Record<ImportSource, string> = {
  JOBHUNTER: 'bg-brand-50 text-amber-900 ring-brand-300',
  ARBEITSAGENTUR: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  COMPANY_BOARDS: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
};

/** Every import, newest first: what was searched and what it brought in, one line each. */
export function ImportHistory() {
  const errorText = useErrorText();
  const { data: runs, isPending, error } = useSyncRuns(20);
  const t = useTranslations('AddJobs.history');
  const [showAll, setShowAll] = useState(false);
  const shown = runs && !showAll ? runs.slice(0, FIRST_ROWS) : runs;
  const hidden = (runs?.length ?? 0) - FIRST_ROWS;

  return (
    <section aria-labelledby="history-heading" className="space-y-2">
      <h2 id="history-heading" className="text-base font-semibold text-slate-900">
        {t('heading')}
      </h2>
      {isPending && <p className="text-sm text-slate-500">{t('loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t('loadError', { error: errorText(error) })}
        </p>
      )}
      {runs?.length === 0 && <p className="text-sm text-slate-500">{t('none')}</p>}
      {shown && shown.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="block min-w-full text-left text-sm sm:table">
              <caption className="sr-only">{t('caption')}</caption>
              <thead className="hidden bg-slate-50 text-[11px] tracking-wide text-slate-600 uppercase sm:table-header-group">
                <tr>
                  <th scope="col" className="w-36 px-3 py-2 font-semibold">
                    {t('when')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {t('search')}
                  </th>
                  <th scope="col" className="w-16 px-3 py-2 text-right font-semibold">
                    {t('new')}
                  </th>
                  <th scope="col" className="w-20 px-3 py-2 text-right font-semibold">
                    {t('alreadySaved')}
                  </th>
                  <th scope="col" className="w-20 px-3 py-2 text-right font-semibold">
                    {t('credits')}
                  </th>
                  <th scope="col" className="w-28 px-3 py-2 font-semibold">
                    {t('pages')}
                  </th>
                </tr>
              </thead>
              <tbody className="block sm:table-row-group">
                {shown.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
              </tbody>
            </table>
          </div>
          {hidden > 0 && (
            <div className="border-t border-slate-100 p-2 text-center">
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => {
                  setShowAll(!showAll);
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {showAll ? t('showLess') : t('showMore', { count: hidden })}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** "greenhouse:n26" → "n26", for the short list under a run. */
const boardName = (board: string) => board.slice(board.indexOf(':') + 1);

function RunRow({ run }: { run: SyncRun }) {
  const t = useTranslations('AddJobs.history');
  const dateTime = useDateTime();
  const listId = useId();
  const [open, setOpen] = useState(false);

  return (
    <tr className="flex flex-wrap items-baseline gap-y-0.5 border-t border-slate-100 py-2 align-top text-slate-700 first:border-t-0 sm:table-row sm:py-0">
      <td
        className={`${LINE} basis-full text-xs whitespace-nowrap text-slate-500 sm:text-sm sm:text-slate-600`}
      >
        {dateTime(run.finishedAt)}
      </td>
      <td className={`${LINE} min-w-0 basis-full`}>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${SOURCE_TAG[run.source]}`}
          >
            {t(`sources.${run.source}`)}
          </span>
          {run.savedSearchName && (
            <span className="font-medium text-slate-900">{run.savedSearchName}:</span>
          )}
          {run.boards.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => {
                setOpen(!open);
              }}
              className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 hover:border-slate-500 aria-expanded:border-slate-900"
            >
              {t('boards', { count: run.boards.length })}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              >
                <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          )}
          {run.summary && (
            <span title={run.summary} className="min-w-0 truncate">
              {run.summary}
            </span>
          )}
          {run.scheduled && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
              {t('scheduled')}
            </span>
          )}
        </div>
        {open && (
          <ul
            id={listId}
            className="mt-1.5 flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-md bg-slate-50 p-1.5"
          >
            {run.boards.map((board) => (
              <li
                key={board}
                title={board}
                className="rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200"
              >
                {boardName(board)}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td data-label={t('new')} className={COUNT}>
        {run.created}
      </td>
      <td data-label={t('alreadySaved')} className={COUNT}>
        {run.updated}
      </td>
      <td data-label={t('credits')} className={COUNT}>
        {run.creditsCharged ?? '–'}
      </td>
      <td className="pl-3 sm:table-cell sm:px-3 sm:py-1.5">
        {run.complete ? (
          <span
            title={t('allFetchedTip')}
            className="inline-flex items-center gap-1 text-xs text-slate-700"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="size-3.5"
            >
              <path d="M5 12l5 5 9-10" />
            </svg>
            {t('allFetched')}
          </span>
        ) : (
          <span className="rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
            {t('moreLeft')}
          </span>
        )}
      </td>
    </tr>
  );
}
