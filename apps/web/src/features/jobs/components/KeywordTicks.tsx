import type { JobInsights } from '@jobsearch/data';
import { useRemoveInsightTerm, useSetHaveTerm } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useErrorText } from '../../../i18n/useErrorText';
import { HaveChip, MissingChip } from './InsightsPanel';

/**
 * Step 1 of the Apply kit: the skills and keywords of the ad your resume doesn't show yet. Tick
 * the ones you really have (✓) and the prompt tells Claude to work each one in (replace a vague
 * word, restructure a bullet, or add it to Skills); × drops one you don't have from this job.
 * So one Claude reply covers them, with no second round.
 */
export function KeywordTicks({ insights }: { insights: JobInsights }) {
  const t = useTranslations('Jobs.apply.keywords');
  const errorText = useErrorText();
  const have = useSetHaveTerm();
  const remove = useRemoveInsightTerm();
  const { jobId } = insights;
  const terms = [...insights.skills, ...insights.keywords];
  // Without a resume nothing is "in" it: the terms are still worth ticking.
  const missing = terms.filter((term) => !term.youHave && (!insights.hasResume || !term.inResume));
  const ticked = terms.filter((term) => term.youHave);
  const error = have.error ?? remove.error;
  if (missing.length === 0 && ticked.length === 0) return null;

  return (
    <section aria-label={t('title')} className="space-y-2 rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h5 className="text-sm font-semibold text-slate-900">{t('title')}</h5>
        <span className="text-xs text-slate-600">
          {t('count', { ticked: ticked.length, total: missing.length + ticked.length })}
        </span>
      </div>
      <p className="text-xs text-slate-600">{t('intro')}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label={t('missingLabel')}>
        {missing.map((term) => (
          <li key={term.term}>
            <MissingChip
              term={term.term}
              relatedTo={term.relatedTo}
              onHave={() => {
                have.mutate({ jobId, term: term.term, have: true });
              }}
              onRemove={() => {
                remove.mutate({ jobId, term: term.term });
              }}
            />
          </li>
        ))}
      </ul>
      {ticked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('tickedLabel')}>
          {ticked.map((term) => (
            <li key={term.term}>
              <HaveChip
                term={term.term}
                onUndo={() => {
                  have.mutate({ jobId, term: term.term, have: false });
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {t('error', { error: errorText(error) })}
        </p>
      )}
    </section>
  );
}
