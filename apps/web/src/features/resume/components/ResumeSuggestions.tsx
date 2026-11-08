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
 * text, and a prompt for Claude when you want a recruiter's view.
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

  return (
    <section
      aria-label={t('title')}
      className={`space-y-3 rounded-lg border px-4 py-3 ${
        suggestions.length
          ? 'border-amber-200 bg-amber-50/60'
          : 'border-emerald-200 bg-emerald-50/60'
      }`}
    >
      <h3 className="text-sm font-semibold text-slate-900">
        {suggestions.length ? t('title') : t('allGood')}
      </h3>
      {suggestions.length > 0 && (
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
  );
}
