import type { ApplicationStatus, Job } from '@jobsearch/data';
import { useMarkFollowedUp, useMyApplications, useUpdateJobStatus } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { InfoTip } from '@/components/InfoTip';
import { useErrorText } from '../../i18n/useErrorText';
import { FunnelCard } from './components/FunnelCard';
import { GmailCheck } from './components/GmailCheck';
import { JobDetailsDialog } from './components/JobDetailsDialog';
import { MailSuggestions } from './components/MailSuggestions';
import { TrackerBoard } from './components/TrackerBoard';

export function TrackerPage() {
  const errorText = useErrorText();
  const t = useTranslations('Tracker');
  const applications = useMyApplications();
  const updateStatus = useUpdateJobStatus();
  const followedUp = useMarkFollowedUp();
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  // The "no news for a week" bar: show only those jobs, or hide the bar for now.
  const [onlyDue, setOnlyDue] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);

  const list = applications.data ?? [];
  const openJob = list.find((app) => app.job.id === openJobId)?.job ?? null;
  const due = list.filter((app) => app.followUpDue).length;
  const shown = onlyDue && due > 0 ? list.filter((app) => app.followUpDue) : list;
  const move = (job: Job, status: ApplicationStatus) => {
    updateStatus.mutate({ id: job.id, status });
  };

  return (
    <section aria-labelledby="tracker-heading" className="space-y-3">
      {/* One line: the title, your funnel, ⓘ and the Gmail check. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 id="tracker-heading" className="text-xl font-semibold text-slate-900">
          {t('title')}
        </h1>
        <InfoTip label={t('infoLabel')} text={t('intro')} />
        {/* On a phone the funnel gets its own line under the title. */}
        <div className="order-last w-full md:order-none md:w-auto">
          <FunnelCard />
        </div>
        <div className="ml-auto">
          <GmailCheck />
        </div>
      </div>

      <MailSuggestions />

      {applications.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {t('loadError', { error: errorText(applications.error) })}
        </p>
      )}
      {due > 0 && !bannerHidden && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
          <span className="flex-1">{t('followUp.banner', { count: due })}</span>
          <button
            type="button"
            aria-pressed={onlyDue}
            onClick={() => {
              setOnlyDue(!onlyDue);
            }}
            className="font-medium underline hover:text-amber-700"
          >
            {onlyDue ? t('followUp.showAll') : t('followUp.onlyThese')}
          </button>
          <button
            type="button"
            aria-label={t('followUp.dismiss')}
            title={t('followUp.dismiss')}
            onClick={() => {
              setBannerHidden(true);
              setOnlyDue(false);
            }}
            className="text-amber-700 hover:text-amber-900"
          >
            ✕
          </button>
        </div>
      )}
      {followedUp.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {t('followUp.error', { error: errorText(followedUp.error) })}
        </p>
      )}
      {updateStatus.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {t('moveError', { error: errorText(updateStatus.error) })}
        </p>
      )}

      {applications.isPending ? (
        <p className="text-sm text-slate-600">{t('loading')}</p>
      ) : list.length === 0 && applications.isSuccess ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          {t('empty')}
        </p>
      ) : (
        <TrackerBoard
          applications={shown}
          onMove={move}
          onFollowedUp={(job) => {
            followedUp.mutate(job.id);
          }}
          onOpen={(job) => {
            setOpenJobId(job.id);
          }}
        />
      )}

      <JobDetailsDialog
        job={openJob}
        onOpen={(job) => {
          setOpenJobId(job.id);
        }}
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
