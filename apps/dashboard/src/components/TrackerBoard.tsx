import type { Application, ApplicationStatus, Job } from '@jobsearch/data';
import { useState } from 'react';
import { formatDate, STATUS_LABELS } from '../format';
import { StatusSelect } from './StatusSelect';

/** The board's columns, in the order a job moves through them. */
export const BOARD_COLUMNS = ['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED'] as const;

const COLUMN_TONE: Record<(typeof BOARD_COLUMNS)[number], string> = {
  SAVED: 'border-t-sky-400',
  APPLIED: 'border-t-indigo-400',
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
}

/**
 * The Kanban board. Drag a card to another column, or use its status menu, which also works
 * with a keyboard and screen readers (dragging alone would leave those users out).
 */
export function TrackerBoard({ applications, onMove, onOpen }: Props) {
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
              dropTarget === status ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'
            }`}
          >
            <h2 id={headingId} className="text-sm font-semibold text-slate-700">
              {STATUS_LABELS[status]}{' '}
              <span className="font-normal text-slate-500">({cards.length})</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {cards.map(({ job, updatedAt }) => (
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
                      className="text-left text-sm font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                    >
                      {job.title}
                    </button>
                    <p className="text-xs text-slate-600">
                      {job.company.name}
                      {job.city ? ` · ${job.city}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Moved {formatDate(updatedAt)}</span>
                    <StatusSelect
                      label={`Status for ${job.title} at ${job.company.name}`}
                      value={status}
                      onChange={(next) => {
                        onMove(job, next);
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
