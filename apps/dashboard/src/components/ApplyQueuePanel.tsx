import type { ApplyQueueItem } from '@jobsearch/data';
import {
  APPLY_QUEUE_URL,
  applyKitUrl,
  getErrorMessage,
  useApplyQueue,
  useApplyQueuePrompt,
  useChangeApplyQueue,
  useSaveApplyQueueReply,
  useUpdateJobStatus,
} from '@jobsearch/data';
import { useState } from 'react';
import { CLAUDE_URL } from './ApplyKitPanel';
import { CopyText } from './CopyText';

/** The one prompt for Claude in Chrome that works through the whole queue, never submitting. */
export function queuePrompt(count: number): string {
  const jobs = count === 1 ? 'one job' : `${String(count)} jobs`;
  return `Please help me apply for ${jobs} in my Apply queue. First open ${APPLY_QUEUE_URL} and read all of it. Then take the jobs one at a time, each in a new tab: open its Apply kit link, then its posting, and fill in the application form following the kit's instructions. Never click Submit: leave each form filled in on its own tab. At the end, tell me for each job what you filled in and what is left for me.`;
}

const LINK = 'text-indigo-700 hover:underline';
const PRIMARY =
  'rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
const SECONDARY =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

/**
 * Writes the replies for the jobs that have none, with one Claude chat: copy one prompt for up
 * to 5 jobs, then paste Claude's whole reply back and each job gets its own part.
 */
function WriteAll({ waiting, onSaved }: { waiting: number; onSaved: (note: string) => void }) {
  const prompt = useApplyQueuePrompt();
  const save = useSaveApplyQueueReply();
  const [note, setNote] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const data = prompt.data;
  const count = data?.jobIds.length ?? 0;
  const jobs = count === 1 ? '1 job' : `${String(count)} jobs`;

  const copyAndOpen = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setNote(`Prompt for ${jobs} copied. Paste it into Claude, then copy Claude’s whole reply.`);
    } catch {
      setNote('Could not copy. Select the prompt below instead.');
    }
    window.open(CLAUDE_URL, '_blank', 'noopener');
  };
  const saveReply = (reply: string) => {
    const before = waiting;
    save.mutate(reply, {
      onSuccess: (queue) => {
        const left = queue.filter((item) => !item.ready).length;
        setNote(null);
        // Said by the panel: this card goes away once every job is ready.
        onSaved(`Saved Claude’s replies for ${String(before - left)} of ${String(before)} jobs.`);
        setText('');
        setPasting(false);
      },
    });
  };
  const pasteFromClipboard = async () => {
    try {
      const reply = await navigator.clipboard.readText();
      if (reply.trim()) {
        saveReply(reply);
        return;
      }
    } catch {
      // Blocked: the box below takes it instead.
    }
    setPasting(true);
  };

  return (
    <div className="space-y-2 rounded-md bg-amber-50 px-3 py-2.5 text-amber-900">
      <p>
        {waiting === 1 ? '1 job has' : `${String(waiting)} jobs have`} no Claude reply yet, so the
        forms would miss your cover letter and answers. One Claude chat writes them all
        {waiting > count && count > 0 ? ` (the first ${String(count)} now, then the rest)` : ''}.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={PRIMARY}
          disabled={!data?.prompt}
          onClick={() => {
            void copyAndOpen();
          }}
        >
          1. Copy prompt for {count > 0 ? jobs : 'the jobs'} and open Claude ↗
        </button>
        <button
          type="button"
          className={SECONDARY}
          disabled={save.isPending || !data?.prompt}
          onClick={() => {
            void pasteFromClipboard();
          }}
        >
          {save.isPending ? 'Saving…' : '2. Paste Claude’s reply from clipboard'}
        </button>
        <button
          type="button"
          className={LINK}
          aria-expanded={pasting}
          onClick={() => {
            setPasting((open) => !open);
          }}
        >
          or paste it yourself
        </button>
      </div>
      {note && (
        <p role="status" className="text-amber-950">
          {note}
        </p>
      )}
      {pasting && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveReply(text);
          }}
        >
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            aria-label="Claude’s reply for the queue"
            placeholder="Paste Claude’s whole reply, with its === JOB 1 … === lines"
            rows={6}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-slate-900"
          />
          <button type="submit" className={PRIMARY} disabled={save.isPending || !text.trim()}>
            Save the replies
          </button>
        </form>
      )}
      {data?.prompt && (
        <details>
          <summary className="cursor-pointer text-xs">Show the prompt</summary>
          <textarea
            readOnly
            value={data.prompt}
            aria-label="Prompt for the queued jobs"
            rows={8}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700"
          />
        </details>
      )}
      {(prompt.isError || save.isError) && (
        <p role="alert" className="text-red-700">
          {save.isError ? 'Could not save the replies' : 'Could not make the prompt'}:{' '}
          {getErrorMessage(save.error ?? prompt.error)}
        </p>
      )}
    </div>
  );
}

/**
 * The jobs you lined up to apply for. One Claude in Chrome prompt fills in every form (it stops
 * before Submit on each), then you check each tab, send it and mark the job Applied here.
 */
export function ApplyQueuePanel() {
  const queue = useApplyQueue();
  const change = useChangeApplyQueue();
  const updateStatus = useUpdateJobStatus();
  const [savedNote, setSavedNote] = useState<string | null>(null);
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
      {notReady > 0 && <WriteAll waiting={notReady} onSaved={setSavedNote} />}
      {savedNote && (
        <p role="status" className="text-emerald-700">
          ✓ {savedNote}
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
