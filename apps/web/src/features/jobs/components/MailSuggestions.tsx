import type { MailSuggestion } from '@jobsearch/data';
import {
  useApproveMailSuggestion,
  useDismissMailSuggestion,
  useMailSuggestions,
} from '@jobsearch/data';
import { useFormatter, useTranslations } from 'next-intl';
import { useErrorText } from '../../../i18n/useErrorText';

/**
 * Employer emails that look like a rejection, an interview invitation or an offer, each with a
 * suggested move for the job. Nothing changes until you press the button.
 */
export function MailSuggestions() {
  const errorText = useErrorText();
  const t = useTranslations('Tracker.mail');
  const jobs = useTranslations('Jobs');
  const format = useFormatter();
  const suggestions = useMailSuggestions();
  const approve = useApproveMailSuggestion();
  const dismiss = useDismissMailSuggestion();

  const list: MailSuggestion[] = suggestions.data ?? [];
  const failed = approve.error ?? dismiss.error;
  if (list.length === 0 && !failed) return null;

  return (
    <section
      aria-labelledby="mail-suggestions-title"
      className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4"
    >
      <div>
        <h2 id="mail-suggestions-title" className="text-base font-semibold text-slate-900">
          {t('title', { count: list.length })}
        </h2>
        <p className="text-sm text-slate-600">{t('hint')}</p>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          {t('error', { error: errorText(failed) })}
        </p>
      )}
      <ul className="space-y-2">
        {list.map((item) => (
          <li key={item.id} className="rounded-md border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-900">
              {item.jobTitle} · {item.company}
            </p>
            <p className="text-sm text-slate-700">
              {t('move', {
                from: jobs(`status.${item.currentStatus}`),
                to: jobs(`status.${item.status}`),
              })}
            </p>
            <blockquote className="mt-1 border-l-2 border-slate-200 pl-2 text-xs text-slate-600">
              <p className="font-medium">{item.subject}</p>
              <p>{item.snippet}</p>
              <p className="mt-0.5 text-slate-500">
                {t('from', {
                  sender: item.fromAddress,
                  account: item.accountEmail,
                  date: format.dateTime(new Date(item.receivedAt), { dateStyle: 'medium' }),
                })}
              </p>
            </blockquote>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={approve.isPending || dismiss.isPending}
                onClick={() => {
                  approve.mutate(item.id);
                }}
                className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                aria-label={t('approveLabel', {
                  job: item.jobTitle,
                  status: jobs(`status.${item.status}`),
                })}
              >
                {t('approve', { status: jobs(`status.${item.status}`) })}
              </button>
              <button
                type="button"
                disabled={approve.isPending || dismiss.isPending}
                onClick={() => {
                  dismiss.mutate(item.id);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                aria-label={t('dismissLabel', { job: item.jobTitle })}
              >
                {t('dismiss')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
