import type { ApplicationStatus, Job } from '@jobsearch/data';
import {
  applyKitUrl,
  getErrorMessage,
  useApplyQueue,
  useChangeApplyQueue,
  useJobInsights,
  useMyProfile,
} from '@jobsearch/data';
import type { ReactNode } from 'react';
import { CopyText } from './CopyText';
import { JobResumePanel } from './JobResumePanel';

/** The short prompt for Claude in Chrome. The Apply kit page it opens holds the rules and facts. */
export function chromePrompt(job: Job): string {
  const posting = job.url ? ` (${job.url})` : '';
  return `Please help me apply for "${job.title}" at ${job.company.name}. First open ${applyKitUrl(job.id)} and read all of it. Then go to the job posting${posting} and fill in the application form following the kit's instructions. Never click Submit: stop and tell me what you filled in and what is left for me.`;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h4 className="font-medium text-slate-900">{title}</h4>
        {children}
      </div>
    </li>
  );
}

interface Props {
  job: Job;
  onStatusChange: (status: ApplicationStatus) => void;
  /** True while this job waits for your "Did you apply?" answer. */
  asking: boolean;
  /** You opened the posting to apply: ask later whether you did. */
  onApplyStarted: (job: Job) => void;
  /** You answered "Did you apply?". */
  onAnswered: (job: Job) => void;
}

/**
 * Everything for one application in four steps: one Claude prompt for the resume, cover letter
 * and form answers; its reply pasted back; Claude in Chrome filling in the form (never
 * submitting it); and marking the job Applied.
 */
export function ApplyKitPanel({ job, onStatusChange, asking, onApplyStarted, onAnswered }: Props) {
  const insights = useJobInsights(job.id);
  const profile = useMyProfile();
  const p = profile.data;
  const noAnswers =
    p && ![p.phone, p.address, p.workPermit, p.noticePeriod, p.salaryExpectation].some(Boolean);
  const applied = !['NONE', 'SAVED'].includes(job.applicationStatus);
  const queue = useApplyQueue();
  const changeQueue = useChangeApplyQueue();
  const queued = queue.data?.some((item) => item.jobId === job.id) ?? false;

  return (
    <section
      aria-labelledby="apply-kit-heading"
      className="space-y-3 border-b border-slate-200 px-5 py-4 text-sm"
    >
      <h3 id="apply-kit-heading" className="text-base font-semibold text-slate-900">
        Apply kit
      </h3>
      {noAnswers && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
          Add your Application answers on “My profile” (phone, work permit, notice period, salary)
          so Claude and the form get them.
        </p>
      )}
      {insights.isError && (
        <p role="alert" className="text-red-700">
          Could not load the kit: {getErrorMessage(insights.error)}
        </p>
      )}
      {insights.data && (
        <ol className="space-y-4">
          <Step n={1} title="Write the resume, cover letter and form answers with Claude">
            <CopyText
              primary
              label="Copy prompt for Claude"
              text={insights.data.prompt}
              copiedHint="Paste it into Claude, then paste Claude’s whole reply in step 2."
              boxLabel="Prompt for Claude"
            >
              <a
                href="https://claude.ai/new"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-indigo-700 hover:underline"
              >
                Open Claude ↗
              </a>
            </CopyText>
          </Step>
          <Step n={2} title="Paste Claude’s reply">
            <JobResumePanel insights={insights.data} />
          </Step>
          <Step n={3} title="Fill in the form with Claude in Chrome">
            <p className="text-slate-600">
              Open the posting in Chrome, open Claude in Chrome and paste this prompt. Claude reads
              your{' '}
              <a
                href={applyKitUrl(job.id)}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-700 hover:underline"
              >
                Apply kit page
              </a>{' '}
              and fills in the form, but never clicks Submit: you check it and send it. Attach the
              resume file yourself.
            </p>
            <CopyText
              label="Copy prompt for Claude in Chrome"
              text={chromePrompt(job)}
              copiedHint="Paste it into Claude in Chrome on the posting’s tab."
              boxLabel="Prompt for Claude in Chrome"
            >
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    onApplyStarted(job);
                  }}
                  className="text-sm text-indigo-700 hover:underline"
                >
                  Open posting ↗
                </a>
              )}
            </CopyText>
            {!applied && (
              <p className="flex flex-wrap items-center gap-2 text-slate-600">
                {queued ? 'In your Apply queue.' : 'Applying to several jobs?'}
                <button
                  type="button"
                  disabled={changeQueue.isPending}
                  onClick={() => {
                    changeQueue.mutate({ jobIds: [job.id], remove: queued });
                  }}
                  className="rounded-md px-2 py-1 font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
                >
                  {queued ? 'Remove from Apply queue' : 'Add to Apply queue'}
                </button>
              </p>
            )}
          </Step>
          <Step n={4} title="Did you apply?">
            {applied ? (
              <p className="text-emerald-700">✓ On your tracker as applied.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {asking && <span className="text-slate-600">You opened this posting.</span>}
                <button
                  type="button"
                  onClick={() => {
                    onStatusChange('APPLIED');
                    onAnswered(job);
                  }}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
                >
                  Yes, mark Applied
                </button>
                {asking && (
                  <button
                    type="button"
                    onClick={() => {
                      onAnswered(job);
                    }}
                    className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    Not yet
                  </button>
                )}
              </div>
            )}
          </Step>
        </ol>
      )}
    </section>
  );
}
