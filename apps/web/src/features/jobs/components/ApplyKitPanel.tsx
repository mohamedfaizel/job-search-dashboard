import type { ApplicationStatus, Job, JobInsights, Profile } from '@jobsearch/data';
import {
  applyKitUrl,
  useApplyQueue,
  useChangeApplyQueue,
  useJobInsights,
  useMyProfile,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { promptSections } from '../reply';
import type { JobFormat } from '../useJobFormat';
import { useJobFormat } from '../useJobFormat';
import { PRIMARY, ReplyInput, SavedReply } from './JobResumePanel';
import { LanguagesBadge } from './LanguagesBadge';

/** The short prompt for Claude in Chrome. The Apply kit page it opens holds the rules and facts. */
export function chromePrompt(job: Job): string {
  const posting = job.url ? ` (${job.url})` : '';
  return `Please help me apply for "${job.title}" at ${job.company.name}. First open ${applyKitUrl(job.id)} and read all of it. Then go to the job posting${posting} and fill in the application form following the kit's instructions. Never click Submit: stop and tell me what you filled in and what is left for me.`;
}

export const CLAUDE_URL = 'https://claude.ai/new';
const LINK = 'text-brand-700 hover:underline';
export type ApplyStep = 1 | 2 | 3;
const STEPS: ApplyStep[] = [1, 2, 3];

/**
 * Which Apply step you are on: 3 once a reply is saved, 2 once the prompt is copied, else 1.
 * Clicking a step shows it, until the next thing you do moves you on again.
 */
export function useApplyStep(jobId: string) {
  const insights = useJobInsights(jobId);
  const [copied, setCopied] = useState(false);
  const [chosen, setChosen] = useState<ApplyStep | null>(null);
  const [pdfStarted, setPdfStarted] = useState(false);
  const suggested: ApplyStep = insights.data?.jobResume ? 3 : copied ? 2 : 1;
  return {
    step: chosen ?? suggested,
    copied,
    /** The resume PDF started downloading when the reply was saved. */
    pdfStarted,
    choose: setChosen,
    markCopied: () => {
      setCopied(true);
      setChosen(null);
    },
    /** A reply was saved: go on to step 3. */
    saved: ({ pdf }: { pdf: boolean }) => {
      setPdfStarted(pdf);
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
  const t = useTranslations('Jobs.apply');
  return (
    <ol aria-label={t('stepsLabel')} className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((n, i) => {
        const state = n < step ? 'done' : n === step ? 'current' : 'next';
        return (
          <li key={n} className={`flex items-center gap-2 sm:gap-3 ${i > 0 ? 'flex-1' : ''}`}>
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
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 text-slate-500'
                }`}
              >
                {state === 'done' ? '✓' : n}
              </span>
              <span className={state === 'current' ? '' : 'max-sm:sr-only'}>
                {t(`steps.${n}`)}
                {state === 'done' && <span className="sr-only"> {t('done')}</span>}
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
  const t = useTranslations('Jobs.apply');
  return (
    <details className="text-sm">
      <summary className={`cursor-pointer list-none ${LINK}`}>{t('showPrompt')}</summary>
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

/**
 * The Claude prompt, folded away, in readable sections. Long ones (your resume, the job ad)
 * stay folded inside too.
 */
function PromptView({ text }: { text: string }) {
  const t = useTranslations('Jobs.apply');
  return (
    <details className="w-full text-sm">
      <summary className={`cursor-pointer list-none ${LINK}`}>{t('showPrompt')}</summary>
      <div
        aria-label={t('promptLabel')}
        role="group"
        className="mt-2 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3"
      >
        {promptSections(text).map((part, i) => {
          const body = <p className="whitespace-pre-wrap text-slate-700">{part.body}</p>;
          if (!part.title) return <div key={i}>{body}</div>;
          const long = part.body.split('\n').length > 12;
          return long ? (
            <details key={i}>
              <summary className="cursor-pointer font-semibold text-slate-900">
                {part.title}
              </summary>
              <div className="mt-1">{body}</div>
            </details>
          ) : (
            <div key={i} className="space-y-0.5">
              <h5 className="font-semibold text-slate-900">{part.title}</h5>
              {body}
            </div>
          );
        })}
      </div>
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
function facts(
  insights: JobInsights,
  profile: Profile | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
  f: JobFormat,
) {
  const answers =
    profile &&
    [profile.phone, profile.workPermit, profile.noticePeriod, profile.salaryExpectation].some(
      Boolean,
    );
  const level = f.germanLevel(insights);
  return [
    { text: t('facts.master') },
    insights.germanRequired
      ? {
          text: level ? t('facts.germanLevel', { level }) : t('facts.german'),
          warn: true,
        }
      : { text: t('facts.english') },
    answers && { text: t('facts.answers') },
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
  const errorText = useErrorText();
  const insights = useJobInsights(job.id);
  const profile = useMyProfile();
  const t = useTranslations('Jobs.apply');
  const f = useJobFormat();
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
        {t('loadError', { error: errorText(insights.error) })}
      </p>
    );
  }
  if (!data) return <p className="text-sm text-slate-500">{t('loading')}</p>;

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
      className="h-9 rounded-lg px-3 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50"
    >
      {queued ? t('removeQueue') : t('addQueue')}
    </button>
  );

  return (
    <section aria-label={t('kitLabel')} className="space-y-5 text-sm">
      <Stepper step={steps.step} onChoose={steps.choose} />

      {applied && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">{t('applied')}</p>
      )}
      {asking && !applied && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2">
          <span className="flex-1 text-brand-900">{t('askOpened')}</span>
          <button
            type="button"
            onClick={() => {
              onStatusChange('APPLIED');
              onAnswered(job);
            }}
            className="h-8 rounded-lg bg-brand-600 px-3 font-medium text-white hover:bg-brand-700"
          >
            {t('yes')}
          </button>
          <button
            type="button"
            onClick={() => {
              onAnswered(job);
            }}
            className="h-8 rounded-lg px-3 text-slate-600 hover:bg-white"
          >
            {t('notYet')}
          </button>
        </div>
      )}

      {steps.step === 1 && (
        <>
          <Card title={t('step1Title')} intro={t('step1Intro')}>
            <ul className="flex flex-wrap gap-1.5" aria-label={t('factsLabel')}>
              {facts(data, p, t, f).map(({ text, warn }) => (
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
              <li>
                <LanguagesBadge insights={data} />
              </li>
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
                {t('copyOpen')}
              </button>
            </div>
            <PromptView text={data.prompt} />
            <p className="text-slate-600">{t('step1Hint')}</p>
          </Card>
          {noAnswers && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
              {t('noAnswers')}
            </p>
          )}
          {!applied && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {queued ? t('inQueue') : t('several')}
              {queueButton}
            </p>
          )}
        </>
      )}

      {steps.step === 2 && (
        <>
          <Card title={t('step2Title')} intro={t('step2Intro')}>
            <ReplyInput jobId={job.id} onSaved={steps.saved} />
          </Card>
          <p className="text-slate-600">
            {steps.copied && (copyFailed ? t('copyFailed') : t('copied'))}
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
              {t('copyAgain')}
            </button>{' '}
            ·{' '}
            <a href={CLAUDE_URL} target="_blank" rel="noreferrer" className={LINK}>
              {t('openClaude')}
            </a>
          </p>
          {copyFailed && <PromptView text={data.prompt} />}
        </>
      )}

      {steps.step === 3 && (
        <>
          {steps.pdfStarted && data.jobResume && (
            <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
              {t('downloading')}
            </p>
          )}
          {data.jobResume ? (
            <SavedReply insights={data} />
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{t('noReply')}</p>
          )}
          <Card title={t('step3Title')} intro={t('step3Intro')}>
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
                {job.url ? t('copyPosting') : t('copyChrome')}
              </button>
              <ShowText label={t('chromeBox')} text={chromePrompt(job)} />
              <span className="flex-1" />
              {queueButton}
            </div>
            <p className="text-xs text-slate-500">
              {t.rich('readsKit', {
                link: (chunks) => (
                  <a href={applyKitUrl(job.id)} target="_blank" rel="noreferrer" className={LINK}>
                    {chunks}
                  </a>
                ),
              })}
              {queued && t('inQueueSuffix')}
            </p>
          </Card>
        </>
      )}
    </section>
  );
}
