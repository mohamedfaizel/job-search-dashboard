import { useTestAiConnection } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { AiState } from '../../../lib/ai-status';
import { markKeyFailed, noteAiResult, useAiState } from '../../../lib/ai-status';

const TAG = {
  chat: 'text-amber-500',
  ai: 'text-violet-600',
  off: 'text-slate-400',
} as const;

/**
 * Who does the work, as a small ✦: yellow is an AI chat you paste into (Claude, ChatGPT…),
 * purple uses AI credits (Resume-Matcher with your Claude API key), grey when that is off.
 * Our own free checks get no mark. The tooltip says it in words; screen readers read the
 * label of the thing it sits on instead.
 */
export function AiTag({ kind }: { kind: keyof typeof TAG }) {
  const t = useTranslations('Jobs.aiLabels');
  return (
    <span
      aria-hidden="true"
      title={t(`${kind}Hint`)}
      className={`inline-block text-sm leading-none ${TAG[kind]}`}
    >
      ✦
    </span>
  );
}

/** The AI credits mark: purple when the AI parts can run, grey when they can't. */
export function AiStateTag() {
  const state = useAiState();
  return <AiTag kind={state === 'on' ? 'ai' : 'off'} />;
}

/**
 * Why the AI parts are off, and what to do: test the key again (one tiny message) or open
 * Profile > Resume-Matcher. The free parts (Fit, Missing keywords) keep working.
 */
export function AiOffNote({ state, compact = false }: { state: AiState; compact?: boolean }) {
  const t = useTranslations('Jobs.aiLabels');
  const test = useTestAiConnection();
  if (state === 'on') return null;
  return (
    <div
      role="note"
      className={`space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 ${compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'}`}
    >
      <p>
        <b>{t('offTitle')}</b> {t(`offReason.${state}`)} {t('freeStillWorks')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {state === 'keyFailed' && (
          <button
            type="button"
            disabled={test.isPending}
            title={t('testHint')}
            onClick={() => {
              test.mutate(undefined, {
                onSuccess: (result) => {
                  if (result.aiConfigured && result.aiHealthy) noteAiResult(true);
                  else markKeyFailed(result.message);
                },
              });
            }}
            className="h-7 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
          >
            {test.isPending ? t('testing') : t('test')}
          </button>
        )}
        <a
          href="/profile?tab=matcher"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          {t('openProfile')}
        </a>
        {test.data && !(test.data.aiConfigured && test.data.aiHealthy) && (
          <span className="basis-full text-xs text-red-700">{test.data.message}</span>
        )}
      </div>
    </div>
  );
}
