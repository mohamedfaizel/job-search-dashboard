import type { ApplicationStatus, Job } from '@jobsearch/data';
import { useEffect, useRef, useState } from 'react';
import { capitalize, formatDate, formatSalary, WORKPLACE_LABELS } from '../format';
import { ApplyKitPanel } from './ApplyKitPanel';
import { Badge } from './Badge';
import { InsightsPanel } from './InsightsPanel';
import { MatchPanel } from './MatchPanel';
import { StatusSelect } from './StatusSelect';
import { TailorPanel } from './TailorPanel';

interface Props {
  job: Job | null;
  onClose: () => void;
  onStatusChange: (status: ApplicationStatus) => void;
  /** Jobs whose posting you opened from the Apply kit, waiting for "Did you apply?". */
  asking?: ReadonlySet<string>;
  onApplyStarted?: (job: Job) => void;
  onApplyAnswered?: (job: Job) => void;
}

const NOBODY: ReadonlySet<string> = new Set();
const noop = () => undefined;

/**
 * The job description popup. Uses the native <dialog> element, which gives focus
 * trapping, Escape-to-close and a backdrop for free.
 */
export function JobDetailsDialog({
  job,
  onClose,
  onStatusChange,
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

  const salary = job ? formatSalary(job.salaryMinUsd, job.salaryMaxUsd) : '';

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="job-dialog-title"
      className={`p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm ${
        maximized
          ? 'm-0 h-dvh max-h-none w-screen max-w-none rounded-none'
          : 'm-auto w-full max-w-3xl rounded-xl'
      }`}
    >
      {job && (
        <div className={`flex flex-col ${maximized ? 'h-full' : 'max-h-[85vh]'}`}>
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div className="space-y-1">
              <h2 id="job-dialog-title" className="text-lg font-semibold text-slate-900">
                {job.title}
              </h2>
              <p className="text-sm text-slate-600">
                {job.company.name}
                {job.city && ` · ${job.city}`}
                {job.countryCode && `, ${job.countryCode}`}
                {` · Posted ${formatDate(job.postedAt)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setMaximized((m) => !m);
                }}
                aria-label={maximized ? 'Restore size' : 'Maximize'}
                title={maximized ? 'Restore size' : 'Maximize'}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
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
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
            {job.seniority && <Badge tone="orange">{capitalize(job.seniority)}</Badge>}
            {job.workplace && <Badge tone="red">{WORKPLACE_LABELS[job.workplace]}</Badge>}
            {job.jobFunction && <Badge tone="red">{job.jobFunction}</Badge>}
            {salary && (
              <Badge tone="green">
                {salary}
                {job.salaryEstimated && ' (est.)'}
              </Badge>
            )}
            {job.skills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <InsightsPanel jobId={job.id} />
            <ApplyKitPanel
              job={job}
              onStatusChange={onStatusChange}
              asking={asking.has(job.id)}
              onApplyStarted={onApplyStarted}
              onAnswered={onApplyAnswered}
            />
            {job.description && (
              <>
                <MatchPanel jobId={job.id} />
                <TailorPanel jobId={job.id} />
              </>
            )}
            <div className="px-5 py-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">
              {job.description ?? 'No description available.'}
            </div>
          </div>

          <footer className="flex items-center justify-between gap-4 border-t border-slate-200 p-4">
            <StatusSelect
              label="Application status"
              value={job.applicationStatus}
              onChange={onStatusChange}
            />
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Open original posting ↗
              </a>
            )}
          </footer>
        </div>
      )}
    </dialog>
  );
}
