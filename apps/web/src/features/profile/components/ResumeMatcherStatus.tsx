import {
  useIsSyncingResume,
  useMyMatcherResume,
  useResumeMatcherStatus,
  useSyncResumeToMatcher,
  useTestAiConnection,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useErrorText } from '../../../i18n/useErrorText';

/** Shows whether Resume-Matcher, which scores jobs against this resume, is ready to use. */
export function ResumeMatcherStatus() {
  const errorText = useErrorText();
  const t = useTranslations('Profile.matcher');
  const status = useResumeMatcherStatus();
  const testAi = useTestAiConnection();
  // The test result lives on the mutation, so the regular status refresh doesn't hide it.
  const aiResult = testAi.data;
  const ready = status.data?.reachable ?? false;

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
          {status.isPending ? t('checking') : ready ? t('running') : t('notRunning')}
        </span>
      </div>
      <p className="text-sm text-slate-600">{t('intro')}</p>
      {status.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {t('checkFailed', { error: errorText(status.error) })}
        </p>
      ) : (
        status.data && <p className="text-sm text-slate-700">{status.data.message}</p>
      )}
      {status.data?.aiProvider && (
        <p className="text-xs text-slate-500">
          {t('ai')} <span className="font-medium text-slate-700">{status.data.aiProvider}</span>
          {status.data.aiModel && (
            <>
              {' · '}
              <span className="font-medium text-slate-700">{status.data.aiModel}</span>
            </>
          )}
          {t('changeAi')}{' '}
          <a
            href="http://localhost:3100/settings"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-700 underline"
          >
            {t('settings')}
          </a>{' '}
          {t('settingsWins')}
        </p>
      )}

      {ready && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              testAi.mutate();
            }}
            disabled={testAi.isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {testAi.isPending ? t('testing') : t('test')}
          </button>
          <span className="text-xs text-slate-500">{t('testHint')}</span>
        </div>
      )}
      {ready && <MatcherResumePanel />}
      {/* aria-live reads the result out to screen readers when it arrives. */}
      <div aria-live="polite">
        {aiResult && (
          <p className={`text-sm ${aiResult.aiHealthy ? 'text-emerald-700' : 'text-red-700'}`}>
            {aiResult.message}
          </p>
        )}
        {testAi.isError && <p className="text-sm text-red-700">{errorText(testAi.error)}</p>}
      </div>
    </section>
  );
}

/** Your resume's copy inside Resume-Matcher: what it has, and a button to send it again. */
function MatcherResumePanel() {
  const errorText = useErrorText();
  const t = useTranslations('Profile.matcher');
  const resume = useMyMatcherResume();
  const sync = useSyncResumeToMatcher();
  // Also true when the upload above started the send.
  const syncing = useIsSyncingResume();
  const state = resume.data?.state;

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
            <p className={`text-sm ${state === 'FAILED' ? 'text-red-700' : 'text-slate-700'}`}>
              {resume.data.message}
            </p>
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
