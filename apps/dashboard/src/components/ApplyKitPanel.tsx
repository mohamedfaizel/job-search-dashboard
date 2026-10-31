import type { ApplicationStatus, Job, JobInsights, Profile } from '@jobsearch/data';
import {
  applyKitUrl,
  getErrorMessage,
  useApplyQueue,
  useChangeApplyQueue,
  useJobInsights,
  useMyProfile,
} from '@jobsearch/data';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { PRIMARY, ReplyInput, SavedReply } from './JobResumePanel';

/** The short prompt for Claude in Chrome. The Apply kit page it opens holds the rules and facts. */
export function chromePrompt(job: Job): string {
  const posting = job.url ? ` (${job.url})` : '';
  return `Please help me apply for "${job.title}" at ${job.company.name}. First open ${applyKitUrl(job.id)} and read all of it. Then go to the job posting${posting} and fill in the application form following the kit's instructions. Never click Submit: stop and tell me what you filled in and what is left for me.`;
}

export const CLAUDE_URL = 'https://claude.ai/new';
const LINK = 'text-indigo-700 hover:underline';
const STEPS = ['Write with Claude', 'Save the reply', 'Fill the form'] as const;
export type ApplyStep = 1 | 2 | 3;

/**
 * Which Apply step you are on: 3 once a reply is saved, 2 once the prompt is copied, else 1.
 * Clicking a step shows it, until the next thing you do moves you on again.
 */
export function useApplyStep(jobId: string) {
  const insights = useJobInsights(jobId);
  const [copied, setCopied] = useState(false);
  const [chosen, setChosen] = useState<ApplyStep | null>(null);
  const suggested: ApplyStep = insights.data?.jobResume ? 3 : copied ? 2 : 1;
  return {
    step: chosen ?? suggested,
    copied,
    choose: setChosen,
    markCopied: () => {
      setCopied(true);
      setChosen(null);
    },
    /** A reply was saved: go on to step 3. */
    saved: () => {
      setChosen(null);
    },
  };
}
export type ApplyStepState = ReturnType<typeof useApplyStep>;

/** Copies the text, then opens the page in a new tab (Claude, or the posting). */
async function copyAndOpen(text: string, url: string | null): Promise<boolean> {
  let ok = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    ok = false;
  }
  if (url) window.open(url, '_blank', 'noopener');
  return ok;
}

function Stepper({ step, onChoose }: { step: ApplyStep; onChoose: (s: ApplyStep) => void }) {
  return (
    <ol aria-label="Apply steps" className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((label, i) => {
        const n = (i + 1) as ApplyStep;
        const state = n < step ? 'done' : n === step ? 'current' : 'next';
        return (
          <li key={label} className={`flex items-center gap-2 sm:gap-3 ${i > 0 ? 'flex-1' : ''}`}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`h-[1.5px] flex-1 ${n <= step ? 'bg-emerald-300' : 'bg-slate-200'}`}
              />
            )}
            <button
              type="button"
              aria-current={state === 'current' ? 'step' : undefined}
              onClick={() => {
                onChoose(n);
              }}
              className={`flex items-center gap-2 text-sm font-medium ${
                state === 'done'
                  ? 'text-emerald-700'
                  : state === 'current'
                    ? 'text-slate-900'
                    : 'text-slate-500'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-semibold ${
                  state === 'done'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : state === 'current'
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-300 text-slate-500'
                }`}
              >
                {state === 'done' ? '✓' : n}
              </span>
              <span className={state === 'current' ? '' : 'max-sm:sr-only'}>
                {label}
                {state === 'done' && <span className="sr-only"> (done)</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Card({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="space-y-1">
        <h4 className="text-[15px] font-semibold text-slate-900">{title}</h4>
        <p className="text-slate-600">{intro}</p>
      </div>
      {children}
    </div>
  );
}

function ShowText({ label, text }: { label: string; text: string }) {
  return (
    <details className="text-sm">
      <summary className={`cursor-pointer list-none ${LINK}`}>Show the prompt</summary>
      <textarea
        readOnly
        value={text}
        aria-label={label}
        rows={8}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700"
        onFocus={(e) => {
          e.currentTarget.select();
        }}
      />
    </details>
  );
}

const COPY_ICON = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-4 w-4 fill-none stroke-current stroke-2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

/** What the prompt is built from, so you know what Claude will get before you copy it. */
function facts(insights: JobInsights, profile: Profile | undefined) {
  const missing = [...insights.skills, ...insights.keywords].filter(
    (t) => !t.inResume && !t.youHave,
  ).length;
  const mustAdd = [...insights.skills, ...insights.keywords].filter((t) => t.youHave).length;
  const german = profile?.languages.find((l) => /german|deutsch/i.test(l));
  const answers =
    profile &&
    [profile.phone, profile.workPermit, profile.noticePeriod, profile.salaryExpectation].some(
      Boolean,
    );
  return [
    { text: 'Master resume' },
    insights.hasResume && missing > 0 && { text: `${String(missing)} missing terms to cover` },
    mustAdd > 0 && { text: `${String(mustAdd)} skills you have to add` },
    insights.germanRequired
      ? {
          text: `Written in German${insights.germanLevel ? ` (${insights.germanLevel} required)` : ''}`,
          warn: true,
        }
      : { text: 'Written in English' },
    german && { text: `${german} on the resume` },
    answers && { text: 'Application answers' },
  ].filter((f): f is { text: string; warn?: boolean } => Boolean(f));
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
  /** Shared with the popup, so its tab can say "step 2 of 3". */
  steps?: ApplyStepState;
}

/**
 * The Apply tab in three steps: one Claude prompt writes the resume, cover letter and form
 * answers; its reply comes back with one click; Claude in Chrome fills in the form (never
 * submitting it). The popup's footer marks the job Applied.
 */
export function ApplyKitPanel(props: Props) {
  const own = useApplyStep(props.job.id);
  return <ApplyKit {...props} steps={props.steps ?? own} />;
}

function ApplyKit({
  job,
  onStatusChange,
  asking,
  onApplyStarted,
  onAnswered,
  steps,
}: Props & { steps: ApplyStepState }) {
  const insights = useJobInsights(job.id);
  const profile = useMyProfile();
  const p = profile.data;
  const noAnswers =
    p && ![p.phone, p.address, p.workPermit, p.noticePeriod, p.salaryExpectation].some(Boolean);
  const applied = !['NONE', 'SAVED'].includes(job.applicationStatus);
  const queue = useApplyQueue();
  const changeQueue = useChangeApplyQueue();
  const queued = queue.data?.some((item) => item.jobId === job.id) ?? false;
  const [copyFailed, setCopyFailed] = useState(false);
  const data = insights.data;

  if (insights.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Could not load the kit: {getErrorMessage(insights.error)}
      </p>
    );
  }
  if (!data) return <p className="text-sm text-slate-500">Loading the Apply kit…</p>;

  const copyClaudePrompt = async () => {
    setCopyFailed(!(await copyAndOpen(data.prompt, CLAUDE_URL)));
    steps.markCopied();
  };

  const queueButton = !applied && (
    <button
      type="button"
      disabled={changeQueue.isPending}
      onClick={() => {
        changeQueue.mutate({ jobIds: [job.id], remove: queued });
      }}
      className="h-9 rounded-lg px-3 text-sm font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
    >
      {queued ? 'Remove from Apply queue' : 'Add to Apply queue'}
    </button>
  );

  return (
    <section aria-label="Apply kit" className="space-y-5 text-sm">
      <Stepper step={steps.step} onChoose={steps.choose} />

      {applied && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
          ✓ On your tracker as applied.
        </p>
      )}
      {asking && !applied && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
          <span className="flex-1 text-indigo-900">You opened this posting. Did you apply?</span>
          <button
            type="button"
            onClick={() => {
              onStatusChange('APPLIED');
              onAnswered(job);
            }}
            className="h-8 rounded-lg bg-emerald-600 px-3 font-medium text-white hover:bg-emerald-700"
          >
            Yes, mark Applied
          </button>
          <button
            type="button"
            onClick={() => {
              onAnswered(job);
            }}
            className="h-8 rounded-lg px-3 text-slate-600 hover:bg-white"
          >
            Not yet
          </button>
        </div>
      )}

      {steps.step === 1 && (
        <>
          <Card
            title="Claude writes your resume, cover letter and form answers"
            intro="One prompt, one reply. It knows the job, your master resume and your Application answers."
          >
            <ul className="flex flex-wrap gap-1.5" aria-label="What the prompt uses">
              {facts(data, p).map(({ text, warn }) => (
                <li
                  key={text}
                  className={`rounded-md px-2.5 py-1 text-xs ring-1 ring-inset ${
                    warn
                      ? 'bg-orange-50 text-orange-800 ring-orange-200'
                      : 'bg-slate-50 text-slate-700 ring-slate-200'
                  }`}
                >
                  {text}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                className={PRIMARY}
                onClick={() => {
                  void copyClaudePrompt();
                }}
              >
                {COPY_ICON}
                Copy prompt and open Claude ↗
              </button>
              <ShowText label="Prompt for Claude" text={data.prompt} />
            </div>
            <p className="text-slate-600">
              Claude opens in a new tab with the prompt on your clipboard: paste it and send. When
              Claude answers, copy its whole reply and come back for step 2.
            </p>
          </Card>
          {noAnswers && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
              Add your Application answers on “My profile” (phone, work permit, notice period,
              salary) so Claude and the form get them.
            </p>
          )}
          {!applied && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {queued ? 'In your Apply queue.' : 'Applying to several jobs?'}
              {queueButton}
            </p>
          )}
        </>
      )}

      {steps.step === 2 && (
        <>
          <Card
            title="Bring Claude’s reply back"
            intro="In Claude, copy the whole reply (the copy button under it). Then one click here saves it."
          >
            <ReplyInput jobId={job.id} onSaved={steps.saved} />
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                We keep these from the reply
              </p>
              <p className="text-slate-700">Resume (scored) · Cover letter · Form answers</p>
            </div>
          </Card>
          <p className="text-slate-600">
            {steps.copied && (copyFailed ? 'Could not copy the prompt. ' : '✓ Prompt copied · ')}
            <button
              type="button"
              className={LINK}
              onClick={() => {
                void copyAndOpen(data.prompt, null).then((ok) => {
                  setCopyFailed(!ok);
                  steps.markCopied();
                });
              }}
            >
              Copy again
            </button>{' '}
            ·{' '}
            <a href={CLAUDE_URL} target="_blank" rel="noreferrer" className={LINK}>
              Open Claude ↗
            </a>
          </p>
          {copyFailed && <ShowText label="Prompt for Claude" text={data.prompt} />}
        </>
      )}

      {steps.step === 3 && (
        <>
          {data.jobResume ? (
            <SavedReply insights={data} />
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
              No reply saved yet. Claude in Chrome can still fill in the form from your profile.
            </p>
          )}
          <Card
            title="Let Claude in Chrome fill in the form"
            intro="It reads your Apply kit, fills in the posting’s form and stops before Submit. You attach the PDF, check it and press Submit."
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                className={PRIMARY}
                onClick={() => {
                  void copyAndOpen(chromePrompt(job), job.url);
                  if (job.url) onApplyStarted(job);
                }}
              >
                {COPY_ICON}
                {job.url ? 'Copy prompt and open posting ↗' : 'Copy prompt for Claude in Chrome'}
              </button>
              <ShowText label="Prompt for Claude in Chrome" text={chromePrompt(job)} />
              <span className="flex-1" />
              {queueButton}
            </div>
            <p className="text-xs text-slate-500">
              Claude in Chrome reads the{' '}
              <a href={applyKitUrl(job.id)} target="_blank" rel="noreferrer" className={LINK}>
                Apply kit page
              </a>
              {queued && ' · In your Apply queue.'}
            </p>
          </Card>
        </>
      )}
    </section>
  );
}
