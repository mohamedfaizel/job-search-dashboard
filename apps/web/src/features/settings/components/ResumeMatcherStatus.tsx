import {
  useIsSyncingResume,
  useMe,
  useMyMatcherResume,
  useResumeMatcherStatus,
  useSyncResumeToMatcher,
  useTestAiConnection,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useErrorText } from '../../../i18n/useErrorText';
import { markKeyFailed, noteAiResult } from '../../../lib/ai-status';
import { useMatcherText } from '../../../lib/matcher-text';

/**
 * Shows whether Resume-Matcher, which scores jobs against your resume with your AI key, is
 * ready to use. Sits under the AI key in Settings > API keys.
 */
export function ResumeMatcherStatus() {
  const errorText = useErrorText();
  const t = useTranslations('Settings.matcher');
  const status = useResumeMatcherStatus();
  const testAi = useTestAiConnection();
  // The test result lives on the mutation, so the regular status refresh doesn't hide it.
  const aiResult = testAi.data;
  const ready = status.data?.reachable ?? false;
  // "Not running" is the admin's to fix; everyone else just reads that it's not available.
  const isAdmin = useMe().data?.role === 'ADMIN';
  const text = useMatcherText();

  return (
    <section
      aria-labelledby="rm-status-title"
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rm-status-title" className="text-base font-semibold text-slate-900">
          Resume-Matcher
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            ready ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {status.isPending
            ? t('checking')
            : ready
              ? t('running')
              : isAdmin
                ? t('notRunning')
                : t('unavailable')}
        </span>
      </div>
      <p className="text-sm text-slate-600">{t('intro')}</p>
      {status.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {t('checkFailed', { error: errorText(status.error) })}
        </p>
      ) : (
        status.data && (
          <Sentence
            text={text.status(status.data, isAdmin)}
            detail={text.detail(status.data.error)}
          />
        )
      )}
      {ready && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              testAi.mutate(undefined, {
                // The job popup turns its AI parts off (or on again) from this result.
                onSuccess: (result) => {
                  if (result.aiConfigured && result.aiHealthy) noteAiResult(true);
                  else markKeyFailed(result.message);
                },
              });
            }}
            disabled={testAi.isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {testAi.isPending ? t('testing') : t('test')}
          </button>
          <span className="text-xs text-slate-600">{t('testHint')}</span>
        </div>
      )}
      {ready && <MatcherResumePanel />}
      {/* aria-live reads the result out to screen readers when it arrives. */}
      <div aria-live="polite">
        {aiResult && (
          <Sentence
            className={aiResult.aiHealthy ? 'text-emerald-700' : 'text-red-700'}
            text={text.status(aiResult, isAdmin)}
            detail={text.detail(aiResult.error)}
          />
        )}
        {testAi.isError && <p className="text-sm text-red-700">{errorText(testAi.error)}</p>}
      </div>
    </section>
  );
}

/** Your resume's copy inside Resume-Matcher: what it has, and a button to send it again. */
function MatcherResumePanel() {
  const errorText = useErrorText();
  const t = useTranslations('Settings.matcher');
  const resume = useMyMatcherResume();
  const sync = useSyncResumeToMatcher();
  // Also true when the upload above started the send.
  const syncing = useIsSyncingResume();
  const state = resume.data?.state;
  const text = useMatcherText();

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-slate-900">{t('yourResume')}</h3>
        {state && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              state === 'READY'
                ? 'bg-emerald-50 text-emerald-700'
                : state === 'FAILED'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-800'
            }`}
          >
            {t(`states.${state}`)}
          </span>
        )}
      </div>
      <div aria-live="polite">
        {syncing ? (
          <p className="text-sm text-slate-700">{t('sending')}</p>
        ) : resume.isError ? (
          <p className="text-sm text-red-700">{errorText(resume.error)}</p>
        ) : (
          resume.data && (
            <Sentence
              className={state === 'FAILED' ? 'text-red-700' : 'text-slate-700'}
              text={text.resume(resume.data)}
              detail={text.detail(resume.data.error)}
            />
          )
        )}
        {sync.isError && !syncing && (
          <p className="text-sm text-red-700">{errorText(sync.error)}</p>
        )}
      </div>
      {state && state !== 'NO_FILE' && (
        <button
          type="button"
          onClick={() => {
            sync.mutate();
          }}
          disabled={syncing}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {state === 'NOT_SENT' ? t('send') : t('sendAgain')}
        </button>
      )}
    </div>
  );
}

/** One translated sentence, with the raw (English) error in small print under it. */
function Sentence({
  text,
  detail,
  className = 'text-slate-700',
}: {
  text: string;
  detail: string | null;
  className?: string;
}) {
  return (
    <div className={`text-sm ${className}`}>
      <p>{text}</p>
      {detail && <p className="mt-0.5 break-words text-xs opacity-80">{detail}</p>}
    </div>
  );
}
