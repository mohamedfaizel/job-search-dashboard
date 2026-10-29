import type { Job } from '@jobsearch/data';
import {
  ActionsCell,
  JobCell,
  LocationCell,
  MatchCell,
  PostedCell,
  SalaryCell,
  SelectCell,
  StatusCell,
  VisaCell,
} from './columns';

/**
 * The job list on a phone: one card per job with the same parts as a table row (it reuses the
 * cells), stacked so nothing needs scrolling sideways.
 */
export function JobCards({ jobs, isFetching }: { jobs: Job[]; isFetching: boolean }) {
  return (
    <ul
      aria-label="Jobs"
      className={`space-y-3 ${isFetching ? 'opacity-60 transition-opacity' : ''}`}
    >
      {jobs.map((job) => (
        <li key={job.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 text-[13px]">
              <JobCell job={job} />
            </div>
            {job.matchStatus && <MatchCell job={job} />}
            <SelectCell job={job} />
          </div>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2 text-[13px]">
            <LocationCell job={job} />
            <SalaryCell job={job} />
            <PostedCell job={job} />
            <VisaCell visa={job.visa} hideUnknown />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <StatusCell job={job} />
            <ActionsCell job={job} withText />
          </div>
        </li>
      ))}
    </ul>
  );
}
