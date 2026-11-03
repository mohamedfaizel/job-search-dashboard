import type { Application, ApplicationStatus, Job } from '@jobsearch/data';
import { useMyProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { followUpEmail } from '../followUpEmail';
import { useJobFormat } from '../useJobFormat';
import { Badge } from './Badge';
import { StatusSelect } from './StatusSelect';
import { isExpired } from './StillOpen';

/** The board's columns, in the order a job moves through them. */
export const BOARD_COLUMNS = ['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED'] as const;

const COLUMN_TONE: Record<(typeof BOARD_COLUMNS)[number], string> = {
  SAVED: 'border-t-sky-400',
  APPLIED: 'border-t-brand-400',
  INTERVIEWING: 'border-t-amber-400',
  OFFER: 'border-t-emerald-400',
  REJECTED: 'border-t-red-400',
};

/** What a dragged card carries, so a drop knows which job moved. */
const DRAG_TYPE = 'application/x-job-id';

interface Props {
  applications: Application[];
  onMove: (job: Job, status: ApplicationStatus) => void;
  onOpen: (job: Job) => void;
  /** You followed up on this application: the reminder waits another week. */
  onFollowedUp?: (job: Job) => void;
}

const SMALL_BUTTON =
  'inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50';

/** "Follow up?" on a card: copy a ready email, then say you sent it. */
function FollowUp({ app, onFollowedUp }: { app: Application; onFollowedUp: (job: Job) => void }) {
  const t = useTranslations('Tracker.followUp');
  const profile = useMyProfile();
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const name = [profile.data?.firstName, profile.data?.lastName].filter(Boolean).join(' ');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(followUpEmail(app, name));
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <div className="space-y-2 rounded-md bg-amber-50 p-2 ring-1 ring-amber-200 ring-inset">
      <p className="text-xs text-amber-800">{t('hint')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void copy();
          }}
          className={SMALL_BUTTON}
        >
          {t('copy')}
        </button>
        <button
          type="button"
          onClick={() => {
            onFollowedUp(app.job);
          }}
          className={SMALL_BUTTON}
        >
          {t('done')}
        </button>
      </div>
      {copied && (
        <p role="status" className="text-xs text-amber-800">
          {copied === 'yes' ? t('copied') : t('copyFailed')}
        </p>
      )}
    </div>
  );
}

/**
 * The Kanban board. Drag a card to another column, or use its status menu, which also works
 * with a keyboard and screen readers (dragging alone would leave those users out).
 */
export function TrackerBoard({ applications, onMove, onOpen, onFollowedUp }: Props) {
  const t = useTranslations('Tracker');
  const row = useTranslations('Jobs.row');
  const f = useJobFormat();
  const [dropTarget, setDropTarget] = useState<ApplicationStatus | null>(null);

  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
      {BOARD_COLUMNS.map((status) => {
        const cards = applications.filter((app) => app.status === status);
        const headingId = `tracker-${status.toLowerCase()}`;
        return (
          // Dragging is a mouse shortcut; each card's status menu does the same by keyboard.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <section
            key={status}
            aria-labelledby={headingId}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
              e.preventDefault(); // allows the drop
              setDropTarget(status);
            }}
            onDragLeave={(e) => {
              // Ignore leaving into a child element of the same column.
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDropTarget(null);
              const jobId = e.dataTransfer.getData(DRAG_TYPE);
              const app = applications.find((a) => a.job.id === jobId);
              if (app && app.status !== status) onMove(app.job, status);
            }}
            className={`flex min-h-40 flex-col gap-2 rounded-lg border border-t-4 bg-slate-50 p-3 ${COLUMN_TONE[status]} ${
              dropTarget === status ? 'border-brand-400 bg-brand-50' : 'border-slate-200'
            }`}
          >
            <h2 id={headingId} className="text-sm font-semibold text-slate-700">
              {f.status(status)}{' '}
              <span className="font-normal text-slate-500">({cards.length})</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {cards.map((app) => {
                const { job, updatedAt } = app;
                return (
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- see above
                  <li
                    key={job.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_TYPE, job.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="cursor-grab space-y-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpen(job);
                        }}
                        className="text-left text-sm font-medium text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {job.title}
                      </button>
                      <p className="flex items-center gap-1.5 text-xs text-slate-600">
                        {app.followUpDue && (
                          <Badge tone="orange" title={t('followUp.badgeHint')}>
                            {t('followUp.badge')}
                          </Badge>
                        )}
                        {isExpired(job) && (
                          <Badge tone="red" title={row('expiredHint')}>
                            {row('expired')}
                          </Badge>
                        )}
                        {job.company.name}
                        {job.city ? ` · ${job.city}` : ''}
                      </p>
                    </div>
                    {app.followUpDue && onFollowedUp && (
                      <FollowUp app={app} onFollowedUp={onFollowedUp} />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">
                        {t('moved', { date: f.date(updatedAt) })}
                        {app.followedUpAt && !app.followUpDue && (
                          <span className="block">
                            {t('followUp.followedUp', { date: f.date(app.followedUpAt) })}
                          </span>
                        )}
                      </span>
                      <StatusSelect
                        label={row('statusFor', { job: f.jobName(job) })}
                        value={status}
                        onChange={(next) => {
                          onMove(job, next);
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
