import { useTestAiConnection } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { AiState } from '../../../lib/ai-status';
import { markKeyFailed, noteAiResult, useAiState } from '../../../lib/ai-status';

const TAG = {
  free: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ai: 'bg-violet-50 text-violet-700 ring-violet-200',
  off: 'bg-slate-100 text-slate-500 ring-slate-200',
} as const;

/**
 * Who does the work, as a small tag: "Free" is our own keyword check (no AI), "✦" is
 * Resume-Matcher with your Claude API key (costs credits), "Off" when that can't run now.
 * The tooltip says it in words; screen readers read the label of the thing it sits on instead.
 */
export function AiTag({ kind, long = false }: { kind: keyof typeof TAG; long?: boolean }) {
  const t = useTranslations('Jobs.aiLabels');
  return (
    <span
      aria-hidden="true"
      title={t(`${kind}Hint`)}
      className={`inline-flex h-5 items-center rounded-full px-1.5 text-[11px] leading-none font-semibold ring-1 ring-inset ${TAG[kind]}`}
    >
      {kind === 'ai' ? (long ? t('aiLong') : '✦') : t(kind)}
    </span>
  );
}

/** The AI tag for the AI parts: "✦" when they can run, "Off" when they can't. */
export function AiStateTag({ long = false }: { long?: boolean }) {
  const state = useAiState();
  return <AiTag kind={state === 'on' ? 'ai' : 'off'} long={long} />;
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
