import type { MatcherResumeState } from '@jobsearch/data';
import {
  getErrorMessage,
  useIsSyncingResume,
  useMyMatcherResume,
  useResumeMatcherStatus,
  useSyncResumeToMatcher,
  useTestAiConnection,
} from '@jobsearch/data';

/** Shows whether Resume-Matcher, which scores jobs against this resume, is ready to use. */
export function ResumeMatcherStatus() {
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
          {status.isPending ? 'Checking…' : ready ? 'Running' : 'Not running'}
        </span>
      </div>
      <p className="text-sm text-slate-600">
        Scores each job against your resume (ATS score) and writes a tailored version.
      </p>
      {status.isError ? (
        <p role="alert" className="text-sm text-red-700">
          Could not check Resume-Matcher: {getErrorMessage(status.error)}
        </p>
      ) : (
        status.data && <p className="text-sm text-slate-700">{status.data.message}</p>
      )}
      {status.data?.aiProvider && (
        <p className="text-xs text-slate-500">
          AI: <span className="font-medium text-slate-700">{status.data.aiProvider}</span>
          {status.data.aiModel && (
            <>
              {' · '}
              <span className="font-medium text-slate-700">{status.data.aiModel}</span>
            </>
          )}
          . To change it, set RM_LLM_MODEL in .env, or pick one in{' '}
          <a
            href="http://localhost:3100/settings"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-700 underline"
          >
            Resume-Matcher&apos;s Settings
          </a>{' '}
          (a choice saved there beats .env).
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
            {testAi.isPending ? 'Testing…' : 'Test AI connection'}
          </button>
          <span className="text-xs text-slate-500">Sends one tiny message to the AI provider.</span>
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
        {testAi.isError && <p className="text-sm text-red-700">{getErrorMessage(testAi.error)}</p>}
      </div>
    </section>
  );
}

const STATE_LABEL: Record<MatcherResumeState, string> = {
  NO_FILE: 'No file yet',
  NOT_SENT: 'Not sent',
  OUTDATED: 'Out of date',
  READY: 'Ready',
  FAILED: 'Failed',
};

/** Your resume's copy inside Resume-Matcher: what it has, and a button to send it again. */
function MatcherResumePanel() {
  const resume = useMyMatcherResume();
  const sync = useSyncResumeToMatcher();
  // Also true when the upload above started the send.
  const syncing = useIsSyncingResume();
  const state = resume.data?.state;

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-slate-900">Your resume in Resume-Matcher</h3>
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
            {STATE_LABEL[state]}
          </span>
        )}
      </div>
      <div aria-live="polite">
        {syncing ? (
          <p className="text-sm text-slate-700">
            Sending… Resume-Matcher’s AI is reading your resume, which can take a minute.
          </p>
        ) : resume.isError ? (
          <p className="text-sm text-red-700">{getErrorMessage(resume.error)}</p>
        ) : (
          resume.data && (
            <p className={`text-sm ${state === 'FAILED' ? 'text-red-700' : 'text-slate-700'}`}>
              {resume.data.message}
            </p>
          )
        )}
        {sync.isError && !syncing && (
          <p className="text-sm text-red-700">{getErrorMessage(sync.error)}</p>
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
          {state === 'NOT_SENT' ? 'Send resume' : 'Send again'}
        </button>
      )}
    </div>
  );
}
