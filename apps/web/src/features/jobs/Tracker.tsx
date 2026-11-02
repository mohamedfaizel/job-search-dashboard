import type { ApplicationStatus, Job } from '@jobsearch/data';
import { getErrorMessage, useMyApplications, useUpdateJobStatus } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { JobDetailsDialog } from './components/JobDetailsDialog';
import { TrackerBoard } from './components/TrackerBoard';

export function TrackerPage() {
  const t = useTranslations('Tracker');
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
          {t('title')}
        </h1>
        <p className="text-sm text-slate-600">{t('intro')}</p>
      </div>

      {applications.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {t('loadError', { error: getErrorMessage(applications.error) })}
        </p>
      )}
      {updateStatus.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {t('moveError', { error: getErrorMessage(updateStatus.error) })}
        </p>
      )}

      {applications.isPending ? (
        <p className="text-sm text-slate-500">{t('loading')}</p>
      ) : list.length === 0 && applications.isSuccess ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t('empty')}
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
