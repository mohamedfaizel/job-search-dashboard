import type { ApplicationStatus, Job } from '@jobsearch/data';
import { useJobInsights } from '@jobsearch/data';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { capitalize, formatDate, formatSalary, VISA_LABELS, WORKPLACE_LABELS } from '../format';
import { ApplyKitPanel, useApplyStep } from './ApplyKitPanel';
import { BookmarkIcon, EyeIcon, EyeSlashIcon } from './icons';
import { InsightsPanel } from './InsightsPanel';
import { JobAdPanel } from './JobAdPanel';
import { MatchPanel, scoreTone } from './MatchPanel';
import { StatusSelect } from './StatusSelect';
import { TailorPanel } from './TailorPanel';

interface Props {
  job: Job | null;
  onClose: () => void;
  onStatusChange: (status: ApplicationStatus) => void;
  /** Hides the job (or brings it back, in Hidden jobs). No Hide button without it. */
  onToggleHidden?: ((job: Job) => void) | undefined;
  /** The popup was opened from Hidden jobs, so the button brings the job back. */
  showingHidden?: boolean;
  /** Jobs whose posting you opened from the Apply kit, waiting for "Did you apply?". */
  asking?: ReadonlySet<string>;
  onApplyStarted?: (job: Job) => void;
  onApplyAnswered?: (job: Job) => void;
}

const NOBODY: ReadonlySet<string> = new Set();
const noop = () => undefined;

const TABS = [
  { id: 'fit', label: 'Fit' },
  { id: 'apply', label: 'Apply' },
  { id: 'ad', label: 'Job ad' },
  { id: 'match', label: 'AI match' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const ICON_BUTTON =
  'h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:h-9 sm:w-9';
const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50';
const FIT_PILL = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  orange: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
} as const;

/** "Applied" and every later step mean you already sent it. */
const SENT: ReadonlySet<ApplicationStatus> = new Set([
  'APPLIED',
  'INTERVIEWING',
  'OFFER',
  'REJECTED',
]);

/** Company · place · posted · seniority · workplace · visa · salary · German, on one line. */
function MetaLine({ job }: { job: Job }) {
  const insights = useJobInsights(job.id);
  const salary = formatSalary(job.salaryMinUsd, job.salaryMaxUsd);
  const german = insights.data?.germanRequired ? `German ${insights.data.germanLevel ?? ''}` : '';
  const parts: ReactNode[] = [
    job.company.name,
    [job.city, job.countryCode].filter(Boolean).join(', '),
    `Posted ${formatDate(job.postedAt)}`,
    job.seniority && capitalize(job.seniority),
    job.workplace && WORKPLACE_LABELS[job.workplace],
    job.visa === 'OFFERS' && VISA_LABELS.OFFERS,
    salary && `${salary}${job.salaryEstimated ? ' (est.)' : ''}`,
    german && <span className="font-medium text-amber-700">{german.trim()} required</span>,
  ].filter(Boolean);
  return (
    <p className="text-sm text-slate-600">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {part}
        </span>
      ))}
    </p>
  );
}

/** Everything inside the popup for one job. Keyed by job, so it opens on the Fit tab. */
function JobDetails({
  job,
  onClose,
  onStatusChange,
  onToggleHidden,
  showingHidden,
  maximized,
  onToggleMaximized,
  asking,
  onApplyStarted,
  onApplyAnswered,
}: Omit<Required<Props>, 'job' | 'asking' | 'onToggleHidden'> & {
  job: Job;
  asking: boolean;
  onToggleHidden: Props['onToggleHidden'];
  maximized: boolean;
  onToggleMaximized: () => void;
}) {
  const [tab, setTab] = useState<Tab>('fit');
  const applySteps = useApplyStep(job.id);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const saved = job.applicationStatus !== 'NONE';
  const sent = SENT.has(job.applicationStatus);

  // Arrow keys move between tabs, as screen reader users expect from a tab list.
  const onTabKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const index = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(index + step + TABS.length) % TABS.length]?.id ?? 'fit';
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={`flex flex-col ${maximized ? 'h-full' : 'h-dvh sm:h-[85vh] sm:max-h-[760px]'}`}>
      <header className="flex flex-col gap-2 border-b border-slate-200 px-4 pt-3 sm:px-5 sm:pt-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1 pt-1.5 sm:pt-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2
                id="job-dialog-title"
                className="text-base font-semibold text-slate-900 sm:text-lg"
              >
                {job.title}
              </h2>
              {job.fitScore !== null && (
                <span
                  className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset ${FIT_PILL[scoreTone(job.fitScore) as keyof typeof FIT_PILL]}`}
                >
                  {job.fitScore}% fit
                </span>
              )}
            </div>
            <MetaLine job={job} />
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => {
                onStatusChange(saved ? 'NONE' : 'SAVED');
              }}
              disabled={sent}
              aria-pressed={saved}
              aria-label="Save to tracker"
              title={sent ? 'On your tracker' : saved ? 'Remove from tracker' : 'Save to tracker'}
              className={`${ICON_BUTTON} hidden disabled:opacity-60 sm:inline-flex ${saved ? 'text-indigo-600' : ''}`}
            >
              <BookmarkIcon filled={saved} className="h-[18px] w-[18px]" />
            </button>
            {onToggleHidden && (
              <button
                type="button"
                onClick={() => {
                  onToggleHidden(job);
                }}
                aria-label={showingHidden ? 'Bring back this job' : 'Hide this job'}
                title={showingHidden ? 'Bring back' : 'Hide: not for me'}
                className={`${ICON_BUTTON} hidden sm:inline-flex`}
              >
                {showingHidden ? (
                  <EyeIcon className="h-[18px] w-[18px]" />
                ) : (
                  <EyeSlashIcon className="h-[18px] w-[18px]" />
                )}
              </button>
            )}
            <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
            <button
              type="button"
              onClick={onToggleMaximized}
              aria-label={maximized ? 'Restore size' : 'Maximize'}
              title={maximized ? 'Restore size' : 'Maximize'}
              className={`${ICON_BUTTON} hidden sm:inline-flex`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-4 w-4 fill-none stroke-current stroke-[1.5]"
              >
                {maximized ? (
                  <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" />
                ) : (
                  <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
                )}
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`${ICON_BUTTON} inline-flex`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-4 w-4 fill-none stroke-current stroke-[1.6]"
                strokeLinecap="round"
              >
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Job details sections"
          className="flex justify-between gap-5 sm:justify-start sm:gap-6"
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`job-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`job-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onKeyDown={onTabKey}
              onClick={() => {
                setTab(id);
              }}
              className={`-mb-px h-11 border-b-2 px-0.5 text-sm font-medium ${
                tab === id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
              {id === 'apply' && !SENT.has(job.applicationStatus) && (
                <span className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 max-sm:hidden">
                  step {applySteps.step} of 3
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Every tab stays mounted, so a half-done Apply step survives a look at the ad. */}
        <TabPanel id="fit" active={tab}>
          <InsightsPanel jobId={job.id} />
        </TabPanel>
        <TabPanel id="apply" active={tab}>
          <ApplyKitPanel
            steps={applySteps}
            job={job}
            onStatusChange={onStatusChange}
            asking={asking}
            onApplyStarted={onApplyStarted}
            onAnswered={onApplyAnswered}
          />
        </TabPanel>
        <TabPanel id="ad" active={tab}>
          <JobAdPanel jobId={job.id} description={job.description} />
        </TabPanel>
        <TabPanel id="match" active={tab}>
          <AiMatch jobId={job.id} hasDescription={Boolean(job.description)} />
        </TabPanel>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2 text-sm text-slate-600">
          <span aria-hidden="true">Status</span>
          <StatusSelect
            label="Application status"
            value={job.applicationStatus}
            onChange={onStatusChange}
          />
        </span>
        {onToggleHidden && (
          <button
            type="button"
            onClick={() => {
              onToggleHidden(job);
            }}
            className={`${BUTTON} sm:hidden`}
          >
            {showingHidden ? 'Bring back' : 'Hide'}
          </button>
        )}
        <span className="flex-1" />
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              // You may apply there, so the dashboard asks "Did you apply?" later.
              if (!SENT.has(job.applicationStatus)) onApplyStarted(job);
            }}
            className={BUTTON}
          >
            Open original posting ↗
          </a>
        )}
        {tab !== 'apply' ? (
          <button
            type="button"
            onClick={() => {
              setTab('apply');
            }}
            className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 sm:w-auto"
          >
            Apply →
          </button>
        ) : (
          !sent && (
            <button
              type="button"
              onClick={() => {
                onStatusChange('APPLIED');
                onApplyAnswered(job);
              }}
              className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"
            >
              ✓ Mark Applied
            </button>
          )
        )}
      </footer>
    </div>
  );
}

function TabPanel({ id, active, children }: { id: Tab; active: Tab; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`job-panel-${id}`}
      aria-labelledby={`job-tab-${id}`}
      hidden={id !== active}
      className="px-4 py-4 sm:px-5 sm:py-5"
    >
      {children}
    </div>
  );
}

/** The AI match tab: Resume-Matcher's score and tailoring, with what they read and cost. */
function AiMatch({ jobId, hasDescription }: { jobId: string; hasDescription: boolean }) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
        Scores your <strong>master resume</strong> (the one on My profile) with Resume-Matcher. It
        does not use the resume Claude wrote in the Apply tab.{' '}
        <strong>Each run uses your Claude API credits.</strong> The Fit tab gives the same kind of
        score for free.
      </p>
      {hasDescription ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <MatchPanel jobId={jobId} />
          <TailorPanel jobId={jobId} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          This job has no description, so there is nothing to match.
        </p>
      )}
    </div>
  );
}

/**
 * The job popup. Uses the native <dialog> element, which gives focus trapping,
 * Escape-to-close and a backdrop for free.
 */
export function JobDetailsDialog({
  job,
  onClose,
  onStatusChange,
  onToggleHidden,
  showingHidden = false,
  asking = NOBODY,
  onApplyStarted = noop,
  onApplyAnswered = noop,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Stays as you left it for the next job you open.
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (job && !dialog.open) dialog.showModal();
    if (!job && dialog.open) dialog.close();
  }, [job]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="job-dialog-title"
      className={`p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:rounded-none ${
        maximized
          ? 'm-0 h-dvh max-h-none w-screen max-w-none rounded-none'
          : 'm-auto w-full max-w-3xl rounded-2xl'
      }`}
    >
      {job && (
        <JobDetails
          key={job.id}
          job={job}
          onClose={onClose}
          onStatusChange={onStatusChange}
          onToggleHidden={onToggleHidden}
          showingHidden={showingHidden}
          maximized={maximized}
          onToggleMaximized={() => {
            setMaximized((m) => !m);
          }}
          asking={asking.has(job.id)}
          onApplyStarted={onApplyStarted}
          onApplyAnswered={onApplyAnswered}
        />
      )}
    </dialog>
  );
}
