import type { ResumeSuggestion } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { CopyText } from '../../jobs/components/CopyText';

interface Props {
  suggestions: ResumeSuggestion[];
  /** Empty when there is no resume yet. */
  reviewPrompt: string;
  /** Puts your resume's Achievements lines into the Achievements bank (not saved yet). */
  onUseAchievements: (lines: string) => void;
}

const BUTTON =
  'inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50';

/**
 * Suggestions for your master resume, right after you upload or save it: free checks of the
 * text, and a prompt for Claude when you want a recruiter's view. Folded into a small pill
 * ("⚠ 3 suggestions") that opens over the page, so the Setup tab stays short.
 */
export function ResumeSuggestions({ suggestions, reviewPrompt, onUseAchievements }: Props) {
  const t = useTranslations('Profile.suggestions');
  if (!reviewPrompt) return null;

  const message = (s: ResumeSuggestion) => {
    const [a = '', b = '', c = ''] = s.detail.split('/');
    switch (s.code) {
      case 'NUMBERS':
        return t('NUMBERS', { with: a, bullets: b });
      case 'LENGTH':
        return t('LENGTH', { words: a, pages: b, limit: c });
      case 'ACHIEVEMENTS':
        return t('ACHIEVEMENTS', { count: s.detail.split('\n').length });
      default:
        return t(s.code, { detail: s.detail });
    }
  };

  const many = suggestions.length > 0;
  return (
    // A pill that opens the list under it: the details depend on this resume, so they stay folded.
    <details className="group">
      <summary
        aria-label={t('open')}
        className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium [&::-webkit-details-marker]:hidden ${
          many
            ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
            : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
        }`}
      >
        <span aria-hidden>{many ? '⚠' : '✓'}</span>
        {t('count', { count: suggestions.length })}
        <span aria-hidden className="text-[10px] group-open:rotate-180">
          ▾
        </span>
      </summary>
      <section
        aria-label={t('title')}
        className={`mt-2 space-y-3 rounded-lg border p-3 ${many ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white'}`}
      >
        <h3 className="text-sm font-semibold text-slate-900">{many ? t('title') : t('allGood')}</h3>
        {many && (
          <ul className="space-y-2" aria-label={t('title')}>
            {suggestions.map((s) => (
              <li key={s.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-slate-800">{message(s)}</span>
                {s.code === 'ACHIEVEMENTS' && (
                  <button
                    type="button"
                    className={BUTTON}
                    onClick={() => {
                      onUseAchievements(s.detail);
                    }}
                  >
                    {t('useAchievements')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <CopyText
          label={t('askClaude')}
          text={reviewPrompt}
          copiedHint={t('askClaudeHint')}
          boxLabel={t('askClaudeBox')}
        />
      </section>
    </details>
  );
}
