import type { TermCheck } from '@jobsearch/data';
import { useJobInsights } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Splits the description into text and marked terms: green for what your resume has, red for
 * what it is missing. A term only counts as a whole word, so "java" doesn't mark "javascript".
 */
/** The tooltips on the marked terms, in your language. */
export interface HighlightTitles {
  inResume: string;
  youHave: string;
  missing: string;
}

export function highlight(
  text: string,
  terms: TermCheck[],
  hasResume: boolean,
  titles: HighlightTitles,
): ReactNode[] {
  if (terms.length === 0) return [text];
  const byTerm = new Map(terms.map((t) => [t.term.toLowerCase(), t]));
  // Longest first, so "react native" wins over "react".
  const words = [...byTerm.keys()].sort((a, b) => b.length - a.length).map(escape);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${words.join('|')})(?![\\p{L}\\p{N}])`, 'giu');

  return text.split(pattern).map((part, i) => {
    // split() puts the matches at the odd places.
    const term = i % 2 === 1 ? byTerm.get(part.toLowerCase()) : undefined;
    if (!term) return part;
    const have = hasResume && term.inResume;
    const color = have
      ? 'bg-emerald-100 text-emerald-900'
      : term.youHave
        ? 'bg-sky-100 text-sky-900'
        : 'bg-red-100 text-red-900';
    return (
      <mark
        key={i}
        title={have ? titles.inResume : term.youHave ? titles.youHave : titles.missing}
        className={`rounded px-0.5 ${color}`}
      >
        {part}
      </mark>
    );
  });
}

/** The Job ad tab: the description, with the skills and keywords marked. */
export function JobAdPanel({ jobId, description }: { jobId: string; description: string | null }) {
  const insights = useJobInsights(jobId);
  const t = useTranslations('Jobs.ad');
  const [marked, setMarked] = useState(true);
  const data = insights.data;

  const parts = useMemo(() => {
    if (!description) return null;
    if (!marked || !data) return [description];
    return highlight(description, [...data.skills, ...data.keywords], data.hasResume, {
      inResume: t('inResume'),
      youHave: t('youHave'),
      missing: t('missing'),
    });
  }, [description, marked, data, t]);

  if (!parts) return <p className="text-sm text-slate-500">{t('none')}</p>;

  return (
    <div className="space-y-3">
      {data && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={marked}
              onChange={(e) => {
                setMarked(e.target.checked);
              }}
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            {t('highlight')}
          </label>
          {marked && data.hasResume && (
            <span className="flex items-center gap-3" aria-hidden="true">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" /> {t('legendIn')}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-200" /> {t('legendMissing')}
              </span>
            </span>
          )}
        </div>
      )}
      <div className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{parts}</div>
    </div>
  );
}
