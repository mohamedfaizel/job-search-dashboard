import type { ApplicationStatus, Job } from '@jobsearch/data';
import {
  useApplyQueue,
  useChangeApplyQueue,
  useJobInsights,
  useLastPdfCheck,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAiState } from '../../../lib/ai-status';
import { capitalize } from '../format';
import { useJobFormat } from '../useJobFormat';
import { AiOffNote, AiStateTag, AiTag } from './AiLabels';
import { ApplyKitPanel, useApplyStep } from './ApplyKitPanel';
import { BookmarkIcon, EyeIcon, EyeSlashIcon } from './icons';
import { InsightsPanel } from './InsightsPanel';
import { InterviewPanel } from './InterviewPanel';
import { JobAdPanel } from './JobAdPanel';
import { MatchPanel, scoreTone } from './MatchPanel';
import { PopupLayoutContext } from './popupLayout';
import { StatusSelect } from './StatusSelect';
import { StillOpen } from './StillOpen';
import { TailorPanel } from './TailorPanel';

interface Props {
  job: Job | null;
  onClose: () => void;
  /** Opens a minimized job again (makes it the open job). */
  onOpen: (job: Job) => void;
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

const TABS = ['fit', 'apply', 'interview', 'ad', 'match'] as const;
type Tab = (typeof TABS)[number];

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
  const f = useJobFormat();
  const t = useTranslations('Jobs.popup');
  const salary = f.salary(job.salaryMinUsd, job.salaryMaxUsd);
  const level = insights.data ? f.germanLevel(insights.data) : '';
  const parts: ReactNode[] = [
    job.company.name,
    [job.city, job.countryCode].filter(Boolean).join(', '),
    t('posted', { date: f.date(job.postedAt) }),
    job.seniority && capitalize(job.seniority),
    job.workplace && f.workplace(job.workplace),
    job.visa === 'OFFERS' && f.visa('OFFERS'),
    salary && (job.salaryEstimated ? t('estimated', { salary }) : salary),
    insights.data?.germanRequired && (
      <span
        className="font-medium text-amber-700"
        title={insights.data.germanLevelEstimated ? f.estimatedLevelHint : undefined}
      >
        {level ? t('germanLevelRequired', { level }) : t('germanRequired')}
      </span>
    ),
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
  onMinimize,
  asking,
  onApplyStarted,
  onApplyAnswered,
}: Omit<Required<Props>, 'job' | 'asking' | 'onToggleHidden' | 'onOpen'> & {
  job: Job;
  asking: boolean;
  onToggleHidden: Props['onToggleHidden'];
  maximized: boolean;
  onToggleMaximized: () => void;
  onMinimize: () => void;
}) {
  const t = useTranslations('Jobs.popup');
  const [tab, setTab] = useState<Tab>('fit');
  const applySteps = useApplyStep(job.id);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const saved = job.applicationStatus !== 'NONE';
  const sent = SENT.has(job.applicationStatus);
  const queue = useApplyQueue();
  const changeQueue = useChangeApplyQueue();
  const queued = queue.data?.some((item) => item.jobId === job.id) ?? false;
  // A failed PDF check shows on the Apply tab too, so you see it from any tab.
  const pdfCheck = useLastPdfCheck(job.id);
  const pdfProblem = pdfCheck?.items.some((item) => !item.ok) ?? false;
  const layout = useMemo(
    () => ({ wide: maximized, adText: job.description ?? '' }),
    [maximized, job.description],
  );

  // Arrow keys move between tabs, as screen reader users expect from a tab list.
  const onTabKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const index = TABS.indexOf(tab);
    const next = TABS[(index + step + TABS.length) % TABS.length] ?? 'fit';
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
                id={`job-dialog-title-${job.id}`}
                className="text-base font-semibold text-slate-900 sm:text-lg"
              >
                {job.title}
              </h2>
              {job.fitScore !== null && (
                <span
                  title={t('fitPillHint')}
                  className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset ${FIT_PILL[scoreTone(job.fitScore) as keyof typeof FIT_PILL]}`}
                >
                  {t('fitPill', { score: job.fitScore })}
                </span>
              )}
            </div>
            <MetaLine job={job} />
            {/* Opening the Apply tab checks again, so you don't apply to a closed ad. */}
            <StillOpen job={job} autoCheck={tab === 'apply'} />
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => {
                onStatusChange(saved ? 'NONE' : 'SAVED');
              }}
              disabled={sent}
              aria-pressed={saved}
              aria-label={t('saveLabel')}
              title={sent ? t('onTracker') : saved ? t('removeFromTracker') : t('saveLabel')}
              className={`${ICON_BUTTON} hidden disabled:opacity-60 sm:inline-flex ${saved ? 'text-brand-600' : ''}`}
            >
              <BookmarkIcon filled={saved} className="h-[18px] w-[18px]" />
            </button>
            {onToggleHidden && (
              <button
                type="button"
                onClick={() => {
                  onToggleHidden(job);
                }}
                aria-label={showingHidden ? t('bringBackLabel') : t('hideLabel')}
                title={showingHidden ? t('bringBack') : t('hideHint')}
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
              onClick={onMinimize}
              aria-label={t('minimize')}
              title={t('minimizeHint')}
              className={`${ICON_BUTTON} inline-flex`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-4 w-4 fill-none stroke-current stroke-[1.6]"
                strokeLinecap="round"
              >
                <path d="M3 12.5h10" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onToggleMaximized}
              aria-label={maximized ? t('restore') : t('maximize')}
              title={maximized ? t('restore') : t('maximize')}
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
              aria-label={t('close')}
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
          aria-label={t('tabsLabel')}
          className="flex justify-between gap-5 sm:justify-start sm:gap-6"
        >
          {TABS.map((id) => (
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
              title={
                id === 'fit' ? t('fitTabHint') : id === 'match' ? t('matchTabHint') : undefined
              }
              onKeyDown={onTabKey}
              onClick={() => {
                setTab(id);
              }}
              className={`-mb-px h-11 border-b-2 px-0.5 text-sm font-medium ${
                tab === id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t(`tabs.${id}`)}
              {id === 'apply' && (
                <span className="ml-1 align-middle max-sm:hidden">
                  <AiTag kind="chat" />
                </span>
              )}
              {id === 'match' && (
                <span className="ml-1 align-middle max-sm:hidden">
                  <AiStateTag />
                </span>
              )}
              {id === 'apply' && pdfProblem && (
                <span
                  title={t('pdfProblem')}
                  className="ml-1 rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800"
                >
                  !<span className="sr-only"> {t('pdfProblem')}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <PopupLayoutContext.Provider value={layout}>
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
          <TabPanel id="interview" active={tab}>
            <InterviewPanel jobId={job.id} />
          </TabPanel>
          <TabPanel id="ad" active={tab}>
            <JobAdPanel jobId={job.id} description={job.description} />
          </TabPanel>
          <TabPanel id="match" active={tab}>
            <AiMatch jobId={job.id} hasDescription={Boolean(job.description)} />
          </TabPanel>
        </div>
      </PopupLayoutContext.Provider>

      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2 text-sm text-slate-600">
          <span aria-hidden="true">{t('status')}</span>
          <StatusSelect
            label={t('statusLabel')}
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
            {showingHidden ? t('bringBack') : t('hide')}
          </button>
        )}
        <span className="flex-1" />
        {tab === 'apply' && !sent && (
          <button
            type="button"
            disabled={changeQueue.isPending}
            aria-pressed={queued}
            title={queued ? t('removeQueue') : t('addQueueHint')}
            onClick={() => {
              changeQueue.mutate({ jobIds: [job.id], remove: queued });
            }}
            className={`${BUTTON} disabled:opacity-50 ${queued ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100' : ''}`}
          >
            {queued ? t('inQueue') : t('addQueue')}
          </button>
        )}
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
            {t('openPosting')}
          </a>
        )}
        {tab !== 'apply' ? (
          <button
            type="button"
            onClick={() => {
              setTab('apply');
            }}
            className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 sm:w-auto"
          >
            {t('apply')}
          </button>
        ) : (
          !sent && (
            <button
              type="button"
              onClick={() => {
                onStatusChange('APPLIED');
                onApplyAnswered(job);
              }}
              className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 sm:w-auto"
            >
              {t('markApplied')}
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

/** The AI score tab: Resume-Matcher's score and tailoring, with what they read and cost. */
function AiMatch({ jobId, hasDescription }: { jobId: string; hasDescription: boolean }) {
  const t = useTranslations('Jobs.popup');
  const aiState = useAiState();
  return (
    <div className="space-y-4">
      <AiOffNote state={aiState} />
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
        {t.rich('aiIntro', { b: (chunks) => <strong>{chunks}</strong> })}
      </p>
      {hasDescription ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <MatchPanel jobId={jobId} />
          <TailorPanel jobId={jobId} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t('noDescription')}</p>
      )}
    </div>
  );
}

/** How many jobs can wait as small bars at the bottom, like chats on LinkedIn. */
export const MAX_DOCKED = 5;

/**
 * The job popup. Uses the native <dialog> element, which gives focus trapping,
 * Escape-to-close and a backdrop for free.
 *
 * Minimize turns the popup into a small bar at the bottom right, and the page works again. Up
 * to five jobs can wait there side by side; a sixth pushes out the oldest. Each job keeps its
 * own popup mounted, so a half-done Apply step is still there when you open it again.
 */
export function JobDetailsDialog({
  job,
  onClose,
  onOpen,
  onStatusChange,
  onToggleHidden,
  showingHidden = false,
  asking = NOBODY,
  onApplyStarted = noop,
  onApplyAnswered = noop,
}: Props) {
  // Stays as you left it for the next job you open.
  const [maximized, setMaximized] = useState(false);
  // Every job with a popup (open or minimized), in the order they came. The order never
  // changes, because moving an open <dialog> in the page closes it.
  const [windows, setWindows] = useState<Job[]>([]);
  // The minimized ones, oldest first.
  const [docked, setDocked] = useState<string[]>([]);

  if (job) {
    const known = windows.find((w) => w.id === job.id);
    if (known !== job) {
      setWindows(known ? windows.map((w) => (w.id === job.id ? job : w)) : [...windows, job]);
    }
    // Opened again (from its bar or the table): no longer a bar.
    if (docked.includes(job.id)) setDocked(docked.filter((id) => id !== job.id));
  }

  const forget = (ids: string[]) => {
    setWindows((list) => list.filter((w) => !ids.includes(w.id)));
    setDocked((list) => list.filter((id) => !ids.includes(id)));
  };
  const minimize = (id: string) => {
    const next = [...docked.filter((d) => d !== id), id];
    const pushedOut = next.slice(0, Math.max(0, next.length - MAX_DOCKED));
    setDocked(next.slice(pushedOut.length));
    if (pushedOut.length) setWindows((list) => list.filter((w) => !pushedOut.includes(w.id)));
    onClose();
  };

  return (
    <>
      {windows.map((w) => {
        const isOpen = w.id === job?.id;
        const slot = docked.indexOf(w.id);
        if (!isOpen && slot < 0) return null;
        const shown = isOpen ? job : w;
        return (
          <JobWindow
            key={w.id}
            job={shown}
            // Newest bar on the right, older ones to its left.
            slot={isOpen ? null : docked.length - 1 - slot}
            maximized={maximized}
            onToggleMaximized={() => {
              setMaximized((m) => !m);
            }}
            onMinimize={() => {
              minimize(w.id);
            }}
            onOpen={() => {
              onOpen(w);
            }}
            onClose={() => {
              forget([w.id]);
              if (isOpen) onClose();
            }}
            onStatusChange={onStatusChange}
            onToggleHidden={onToggleHidden}
            showingHidden={showingHidden}
            asking={asking.has(w.id)}
            onApplyStarted={onApplyStarted}
            onApplyAnswered={onApplyAnswered}
          />
        );
      })}
    </>
  );
}

/** One job's popup: full size, or a small bar at the bottom when `slot` is set. */
function JobWindow({
  job,
  slot,
  maximized,
  onToggleMaximized,
  onMinimize,
  onOpen,
  onClose,
  onStatusChange,
  onToggleHidden,
  showingHidden,
  asking,
  onApplyStarted,
  onApplyAnswered,
}: {
  job: Job;
  slot: number | null;
  maximized: boolean;
  onToggleMaximized: () => void;
  onMinimize: () => void;
  onOpen: () => void;
  onClose: () => void;
  onStatusChange: Props['onStatusChange'];
  onToggleHidden: Props['onToggleHidden'];
  showingHidden: boolean;
  asking: boolean;
  onApplyStarted: (job: Job) => void;
  onApplyAnswered: (job: Job) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const minimized = slot !== null;
  const modal = useRef(false);
  // Swapping between modal and the small bar closes the dialog for a moment: not a real close.
  const swapping = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const wantModal = !minimized;
    if (dialog.open && modal.current === wantModal) return;
    if (dialog.open) {
      swapping.current = true;
      dialog.close();
    }
    if (wantModal) dialog.showModal();
    else dialog.show();
    modal.current = wantModal;
  }, [minimized]);

  const titleId = `job-dock-title-${job.id}`;
  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (swapping.current) {
          swapping.current = false;
          return;
        }
        onClose();
      }}
      aria-labelledby={minimized ? titleId : `job-dialog-title-${job.id}`}
      style={minimized ? ({ '--slot': slot } as CSSProperties) : undefined}
      className={
        minimized
          ? // Side by side on wide screens, stacked on small ones.
            'fixed top-auto right-4 bottom-[calc(1.25rem+var(--slot)*3.5rem+var(--tabbar))] left-auto z-50 m-0 w-[min(14rem,calc(100vw-2rem))] rounded-lg p-0 shadow-xl ring-1 ring-slate-200 lg:right-[calc(5.5rem+var(--slot)*14.5rem)] lg:bottom-5'
          : `p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:rounded-none ${
              maximized
                ? 'm-0 h-dvh max-h-none w-screen max-w-none rounded-none'
                : 'm-auto w-full max-w-3xl rounded-2xl'
            }`
      }
    >
      {minimized && <JobDock job={job} titleId={titleId} onOpen={onOpen} onClose={onClose} />}
      <div hidden={minimized} className={maximized && !minimized ? 'h-full' : undefined}>
        <JobDetails
          job={job}
          onClose={onClose}
          onStatusChange={onStatusChange}
          onToggleHidden={onToggleHidden}
          showingHidden={showingHidden}
          maximized={maximized}
          onToggleMaximized={onToggleMaximized}
          onMinimize={onMinimize}
          asking={asking}
          onApplyStarted={onApplyStarted}
          onApplyAnswered={onApplyAnswered}
        />
      </div>
    </dialog>
  );
}

/** The minimized popup: a small bar with the job's title, to open it again or close it. */
function JobDock({
  job,
  titleId,
  onOpen,
  onClose,
}: {
  job: Job;
  titleId: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('Jobs.popup');
  const ICON =
    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900';
  return (
    <div className="flex items-center gap-0.5 bg-white py-1 pr-1 pl-2.5">
      <button
        type="button"
        onClick={onOpen}
        title={`${job.title} · ${job.company.name}`}
        className="flex min-w-0 flex-1 flex-col text-left leading-tight"
      >
        <span id={titleId} className="truncate text-sm font-medium text-slate-900">
          {job.title}
        </span>
        <span className="truncate text-xs text-slate-500">{job.company.name}</span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('openAgain')}
        title={t('openAgain')}
        className={ICON}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.6]"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10l4-4 4 4" />
        </svg>
      </button>
      <button type="button" onClick={onClose} aria-label={t('close')} className={ICON}>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.6]"
          strokeLinecap="round"
        >
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </div>
  );
}
