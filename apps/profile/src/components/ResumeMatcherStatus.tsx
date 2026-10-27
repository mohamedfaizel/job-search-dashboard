import { getErrorMessage, useResumeMatcherStatus, useTestAiConnection } from '@jobsearch/data';

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
