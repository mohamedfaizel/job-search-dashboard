import type { Application, ApplicationStatus, Job } from '@jobsearch/data';
import { useMyProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { followUpEmail } from '../followUpEmail';
import { useIsPhone } from '../useIsPhone';
import { useJobFormat } from '../useJobFormat';
import { Badge } from './Badge';
import { StatusSelect } from './StatusSelect';
import { isExpired } from './StillOpen';

/** The board's columns, in the order a job moves through them. */
const BOARD_COLUMNS = ['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED'] as const;

const COLUMN_TONE: Record<(typeof BOARD_COLUMNS)[number], string> = {
  SAVED: 'border-t-sky-400',
  APPLIED: 'border-t-brand-400',
  INTERVIEWING: 'border-t-amber-400',
  OFFER: 'border-t-emerald-400',
  REJECTED: 'border-t-red-400',
};

type BoardColumn = (typeof BOARD_COLUMNS)[number];

/** Where the phone remembers which columns you folded. */
const FOLDS_KEY = 'tracker-folds';
/** On a phone a long column shows this many cards, then "Show all". */
const PHONE_CARDS = 3;

/**
 * Which columns are folded on a phone. A column you never touched is open when it has cards.
 * What you fold or open is remembered on this device.
 */
function useFolds() {
  const [saved, setSaved] = useState<Partial<Record<BoardColumn, boolean>>>({});
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FOLDS_KEY) ?? '{}') as unknown;
      // Read once after the first render, so the server and browser draw the same page first.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored && typeof stored === 'object') setSaved(stored);
    } catch {
      // No storage (private window): every column starts the default way.
    }
  }, []);
  const save = useCallback((next: Partial<Record<BoardColumn, boolean>>) => {
    setSaved(next);
    try {
      localStorage.setItem(FOLDS_KEY, JSON.stringify(next));
    } catch {
      // Not remembered, but the fold still works for now.
    }
  }, []);
  return { saved, save };
}

/** What a dragged card carries, so a drop knows which job moved. */
const DRAG_TYPE = 'application/x-job-id';

interface Props {
  applications: Application[];
  onMove: (job: Job, status: ApplicationStatus) => void;
  onOpen: (job: Job) => void;
  /** You followed up on this application: the reminder waits another week. */
  onFollowedUp?: (job: Job) => void;
}

/** "Follow up?" on a card, in one row: copy a ready email, then ✓ to say you sent it. */
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
    <div
      title={t('hint')}
      className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2 py-1 text-xs ring-1 ring-amber-200 ring-inset"
    >
      <span className="font-medium text-amber-800">{t('badge')}</span>
      <button
        type="button"
        onClick={() => {
          void copy();
        }}
        className="text-amber-900 underline hover:text-amber-700"
      >
        {t('copy')}
      </button>
      <button
        type="button"
        aria-label={t('done')}
        title={t('done')}
        onClick={() => {
          onFollowedUp(app.job);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-emerald-700 hover:bg-emerald-50"
      >
        ✓
      </button>
      {copied && (
        <span role="status" className="basis-full text-amber-800">
          {copied === 'yes' ? t('copied') : t('copyFailed')}
        </span>
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
  const isPhone = useIsPhone();
  const folds = useFolds();
  const [showAll, setShowAll] = useState<ReadonlySet<BoardColumn>>(() => new Set());
  const countOf = (status: BoardColumn) =>
    applications.filter((app) => app.status === status).length;
  const isOpen = (status: BoardColumn) => folds.saved[status] ?? countOf(status) > 0;
  const setAll = (open: boolean) => {
    folds.save(Object.fromEntries(BOARD_COLUMNS.map((status) => [status, open])));
  };

  return (
    <div className="space-y-2">
      {isPhone && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setAll(false);
            }}
            className="h-11 flex-1 rounded-lg border border-slate-300 bg-white text-sm text-slate-700"
          >
            {t('fold.all')}
          </button>
          <button
            type="button"
            onClick={() => {
              setAll(true);
            }}
            className="h-11 flex-1 rounded-lg border border-slate-300 bg-white text-sm text-slate-700"
          >
            {t('fold.openAll')}
          </button>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {BOARD_COLUMNS.map((status) => {
          const allCards = applications.filter((app) => app.status === status);
          const folded = isPhone && !isOpen(status);
          const cut = isPhone && !showAll.has(status) && allCards.length > PHONE_CARDS;
          const cards = folded ? [] : cut ? allCards.slice(0, PHONE_CARDS) : allCards;
          const headingId = `tracker-${status.toLowerCase()}`;
          const name = (
            <>
              {f.status(status)}{' '}
              <span className="font-normal text-slate-500">({allCards.length})</span>
            </>
          );
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
              // On a computer each column scrolls on its own, so the board fits the window.
              className={`flex flex-col gap-2 rounded-lg border border-t-4 bg-slate-50 p-3 md:max-h-[calc(100dvh-12rem)] md:min-h-40 ${COLUMN_TONE[status]} ${
                dropTarget === status ? 'border-brand-400 bg-brand-50' : 'border-slate-200'
              } ${folded ? 'py-0' : ''}`}
            >
              {isPhone ? (
                <h2 id={headingId} className="text-sm font-semibold text-slate-700">
                  <button
                    type="button"
                    aria-expanded={!folded}
                    onClick={() => {
                      folds.save({ ...folds.saved, [status]: folded });
                    }}
                    className="flex min-h-11 w-full items-center gap-2 text-left"
                  >
                    <span className="flex-1">{name}</span>
                    {folded && allCards.length > 0 && (
                      <span className="text-xs font-normal text-slate-500">
                        {t('fold.tapToOpen')}
                      </span>
                    )}
                    <span aria-hidden="true">{folded ? '▸' : '▾'}</span>
                  </button>
                </h2>
              ) : (
                <h2 id={headingId} className="text-sm font-semibold text-slate-700">
                  {name}
                </h2>
              )}
              <ul className="-mx-1 flex min-h-0 flex-col gap-2 overflow-y-auto px-1">
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
                          {app.followUpDue && !onFollowedUp && (
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
              {cut && !folded && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAll(new Set([...showAll, status]));
                  }}
                  className="min-h-11 text-xs text-slate-600 underline"
                >
                  {t('fold.showAll', { count: allCards.length - PHONE_CARDS })}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
