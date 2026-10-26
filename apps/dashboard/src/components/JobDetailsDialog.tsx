import type { ApplicationStatus, Job } from '@jobsearch/data';
import { useEffect, useRef } from 'react';
import { capitalize, formatDate, formatSalary, WORKPLACE_LABELS } from '../format';
import { Badge } from './Badge';
import { StatusSelect } from './StatusSelect';

interface Props {
  job: Job | null;
  onClose: () => void;
  onStatusChange: (status: ApplicationStatus) => void;
}

/**
 * The job description popup. Uses the native <dialog> element, which gives focus
 * trapping, Escape-to-close and a backdrop for free.
 */
export function JobDetailsDialog({ job, onClose, onStatusChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

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
      className="m-auto w-full max-w-3xl rounded-xl p-0 shadow-2xl backdrop:bg-slate-900/40"
    >
      {job && (
        <div className="flex max-h-[85vh] flex-col">
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
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              ✕
            </button>
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

          <div className="overflow-y-auto px-5 py-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {job.description ?? 'No description available.'}
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
