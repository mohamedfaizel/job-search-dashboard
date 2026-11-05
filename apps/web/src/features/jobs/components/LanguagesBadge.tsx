import type { JobInsights } from '@jobsearch/data';
import { useSetJobLanguages } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

const BADGE =
  'rounded-md px-2.5 py-1 text-xs ring-1 ring-inset bg-slate-50 text-slate-700 ring-slate-200';

/**
 * The languages line of the prompt as a badge next to the others. Click it to edit the line for
 * this job only; it starts as your profile's Languages. Enter or leaving the box saves, Escape
 * cancels, and Reset goes back to the profile's.
 */
export function LanguagesBadge({ insights }: { insights: JobInsights }) {
  const t = useTranslations('Jobs.apply.languages');
  const errorText = useErrorText();
  const save = useSetJobLanguages();
  const { jobId, languages, languagesCustom } = insights;
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string) => {
    setDraft(null);
    if (text.trim() !== languages) save.mutate({ jobId, languages: text });
  };

  if (draft !== null) {
    return (
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- it opens because you clicked the badge
        autoFocus
        aria-label={t('label')}
        value={draft}
        placeholder={t('placeholder')}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          commit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft);
          if (e.key === 'Escape') setDraft(null);
        }}
        className="h-7 w-72 max-w-full rounded-md border border-slate-300 px-2 text-xs"
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setDraft(languages);
        }}
        title={languagesCustom ? t('customHint') : t('hint')}
        className={`${BADGE} ${languagesCustom ? 'ring-slate-900' : ''} hover:bg-white`}
      >
        {t('badge', { languages: languages || t('none') })} <span aria-hidden="true">✎</span>
        <span className="sr-only">{t('edit')}</span>
      </button>
      {languagesCustom && (
        <button
          type="button"
          onClick={() => {
            save.mutate({ jobId, languages: '' });
          }}
          className="text-xs text-brand-600 hover:text-brand-800"
        >
          {t('reset')}
        </button>
      )}
      {save.error && (
        <span role="alert" className="text-xs text-red-700">
          {errorText(save.error)}
        </span>
      )}
    </span>
  );
}
