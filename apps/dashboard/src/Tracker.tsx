import type { ApplicationStatus, Job } from '@jobsearch/data';
import {
  DataProvider,
  getErrorMessage,
  useMyApplications,
  useUpdateJobStatus,
} from '@jobsearch/data';
import { useState } from 'react';
import { JobDetailsDialog } from './components/JobDetailsDialog';
import { TrackerBoard } from './components/TrackerBoard';

/** Exposed to the shell as "dashboard/Tracker", next to "dashboard/App". */
export default function Tracker() {
  return (
    <DataProvider>
      <TrackerPage />
    </DataProvider>
  );
}

export function TrackerPage() {
  const applications = useMyApplications();
  const updateStatus = useUpdateJobStatus();
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  const list = applications.data ?? [];
  const openJob = list.find((app) => app.job.id === openJobId)?.job ?? null;
  const move = (job: Job, status: ApplicationStatus) => {
    updateStatus.mutate({ id: job.id, status });
  };

  return (
    <section aria-labelledby="tracker-heading" className="space-y-4">
      <div>
        <h1 id="tracker-heading" className="text-xl font-semibold text-slate-900">
          Application tracker
        </h1>
        <p className="text-sm text-slate-600">
          Drag a card to another column, or change its status. Only you see your board.
        </p>
      </div>

      {applications.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Could not load your tracker: {getErrorMessage(applications.error)}
        </p>
      )}
      {updateStatus.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Could not move that job: {getErrorMessage(updateStatus.error)}
        </p>
      )}

      {applications.isPending ? (
        <p className="text-sm text-slate-500">Loading your tracker…</p>
      ) : list.length === 0 && applications.isSuccess ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Nothing on your tracker yet. Set a status on a job in Job posts (Saved, Applied…) and it
          shows up here.
        </p>
      ) : (
        <TrackerBoard
          applications={list}
          onMove={move}
          onOpen={(job) => {
            setOpenJobId(job.id);
          }}
        />
      )}

      <JobDetailsDialog
        job={openJob}
        onClose={() => {
          setOpenJobId(null);
        }}
        onStatusChange={(status) => {
          if (openJob) move(openJob, status);
        }}
      />
    </section>
  );
}
