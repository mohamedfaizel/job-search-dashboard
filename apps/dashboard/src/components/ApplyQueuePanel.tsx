import type { ApplyQueueItem } from '@jobsearch/data';
import {
  APPLY_QUEUE_URL,
  applyKitUrl,
  getErrorMessage,
  useApplyQueue,
  useChangeApplyQueue,
  useUpdateJobStatus,
} from '@jobsearch/data';
import { CopyText } from './CopyText';

/** The one prompt for Claude in Chrome that works through the whole queue, never submitting. */
export function queuePrompt(count: number): string {
  const jobs = count === 1 ? 'one job' : `${String(count)} jobs`;
  return `Please help me apply for ${jobs} in my Apply queue. First open ${APPLY_QUEUE_URL} and read all of it. Then take the jobs one at a time, each in a new tab: open its Apply kit link, then its posting, and fill in the application form following the kit's instructions. Never click Submit: leave each form filled in on its own tab. At the end, tell me for each job what you filled in and what is left for me.`;
}

const LINK = 'text-indigo-700 hover:underline';

/**
 * The jobs you lined up to apply for. One Claude in Chrome prompt fills in every form (it stops
 * before Submit on each), then you check each tab, send it and mark the job Applied here.
 */
export function ApplyQueuePanel() {
  const queue = useApplyQueue();
  const change = useChangeApplyQueue();
  const updateStatus = useUpdateJobStatus();
  const items = queue.data ?? [];
  if (items.length === 0) return null;

  const notReady = items.filter((item) => !item.ready).length;
  // Marking a job Applied takes it out of the queue on the server; the status change refreshes it.
  const markApplied = (list: ApplyQueueItem[]) => {
    for (const item of list) updateStatus.mutate({ id: item.jobId, status: 'APPLIED' });
  };

  return (
    <section
      aria-labelledby="apply-queue-heading"
      className="space-y-3 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="apply-queue-heading" className="mr-auto text-base font-semibold text-slate-900">
          Apply queue ({items.length})
        </h2>
        <a href={APPLY_QUEUE_URL} target="_blank" rel="noreferrer" className={LINK}>
          Open queue page ↗
        </a>
        <button
          type="button"
          onClick={() => {
            markApplied(items);
          }}
          className="rounded-md bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700"
        >
          Mark all Applied
        </button>
      </div>
      {notReady > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
          {notReady === 1 ? '1 job has' : `${String(notReady)} jobs have`} no Claude reply saved
          yet. Open it and do steps 1 and 2 of its Apply kit first, so the form gets your cover
          letter and answers.
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.jobId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              <span className="font-medium text-slate-900">{item.title}</span>{' '}
              <span className="text-slate-500">at {item.company}</span>
            </span>
            <span
              className={
                item.ready
                  ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
                  : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800'
              }
            >
              {item.ready ? 'Ready' : 'Needs Claude’s reply'}
            </span>
            <a
              href={applyKitUrl(item.jobId)}
              target="_blank"
              rel="noreferrer"
              className={LINK}
              aria-label={`Apply kit for ${item.title}`}
            >
              Kit ↗
            </a>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className={LINK}
                aria-label={`Posting for ${item.title}`}
              >
                Posting ↗
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                markApplied([item]);
              }}
              className="rounded-md px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-50"
              aria-label={`Mark ${item.title} Applied`}
            >
              Applied
            </button>
            <button
              type="button"
              onClick={() => {
                change.mutate({ jobIds: [item.jobId], remove: true });
              }}
              className="px-1 text-slate-400 hover:text-slate-700"
              aria-label={`Remove ${item.title} from the queue`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <CopyText
        primary
        label="Copy prompt for Claude in Chrome"
        text={queuePrompt(items.length)}
        copiedHint="Paste it into Claude in Chrome. It fills in each form on its own tab and stops before Submit: check each one and send it yourself."
        boxLabel="Prompt for the Apply queue"
      />
      {(change.isError || updateStatus.isError) && (
        <p role="alert" className="text-red-700">
          Could not change the queue: {getErrorMessage(change.error ?? updateStatus.error)}
        </p>
      )}
    </section>
  );
}
