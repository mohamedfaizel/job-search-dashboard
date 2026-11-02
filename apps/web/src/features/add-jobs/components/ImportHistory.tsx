import { useSyncRuns } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useErrorText } from '../../../i18n/useErrorText';
import { useDateTime } from '../format';

/**
 * On phones each import is a short card: the date, then the search, then the numbers on one
 * line, each with its column name (from data-label) in front. Wider screens get the normal table.
 */
const LINE = 'block px-3 sm:table-cell sm:py-2';
const COUNT =
  'inline-flex gap-1 pl-3 tabular-nums before:text-slate-500 before:content-[attr(data-label)] sm:table-cell sm:py-2 sm:pl-3 sm:pr-3 sm:text-right sm:before:content-none';

/** Every import, newest first: what was searched and what it brought in. */
export function ImportHistory() {
  const errorText = useErrorText();
  const { data: runs, isPending, error } = useSyncRuns(20);
  const t = useTranslations('AddJobs.history');
  const dateTime = useDateTime();

  return (
    <section aria-labelledby="history-heading" className="space-y-3">
      <h2 id="history-heading" className="text-lg font-semibold text-slate-900">
        {t('heading')}
      </h2>
      {isPending && <p className="text-sm text-slate-500">{t('loading')}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t('loadError', { error: errorText(error) })}
        </p>
      )}
      {runs?.length === 0 && <p className="text-sm text-slate-500">{t('none')}</p>}
      {runs && runs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="block min-w-full text-left text-sm sm:table">
            <caption className="sr-only">{t('caption')}</caption>
            <thead className="hidden bg-slate-50 text-slate-500 sm:table-header-group">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('when')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('search')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('new')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('alreadySaved')}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('credits')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('pages')}
                </th>
              </tr>
            </thead>
            <tbody className="block sm:table-row-group">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="flex flex-wrap items-baseline gap-y-0.5 border-t border-slate-100 py-2 text-slate-700 first:border-t-0 sm:table-row sm:py-0"
                >
                  <td
                    className={`${LINE} basis-full text-xs whitespace-nowrap text-slate-500 sm:text-sm sm:text-slate-700`}
                  >
                    {dateTime(run.finishedAt)}
                  </td>
                  <td className={`${LINE} basis-full`}>
                    <span>
                      {run.savedSearchName && (
                        <span className="font-medium text-slate-900">{run.savedSearchName}: </span>
                      )}
                      {run.summary}
                      {run.scheduled && (
                        <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                          {t('scheduled')}
                        </span>
                      )}
                    </span>
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
                  <td className="pl-3 sm:table-cell sm:px-3 sm:py-2">
                    {run.complete ? (
                      t('allFetched')
                    ) : (
                      <span className="text-amber-700">{t('moreLeft')}</span>
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
