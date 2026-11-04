import type { ApplyQueueItem } from '@jobsearch/data';
import {
  APPLY_QUEUE_URL,
  applyKitUrl,
  useApplyQueue,
  useApplyQueuePrompt,
  useChangeApplyQueue,
  useMoveInApplyQueue,
  useSaveApplyQueueReply,
  useUpdateJobStatus,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { CLAUDE_URL } from './ApplyKitPanel';
import { CopyText } from './CopyText';

/**
 * The one prompt for Claude in Chrome that works through the whole queue, never submitting. It
 * stays in English whatever your language: it is for Claude, not for you.
 */
function queuePrompt(count: number): string {
  const jobs = count === 1 ? 'one job' : `${String(count)} jobs`;
  return `Please help me apply for ${jobs} in my Apply queue. First open ${APPLY_QUEUE_URL} and read all of it. Then take the jobs one at a time, each in a new tab: open its Apply kit link, then its posting, and fill in the application form following the kit's instructions. Never click Submit: leave each form filled in on its own tab. At the end, tell me for each job what you filled in and what is left for me.`;
}

const LINK = 'text-brand-700 hover:underline';
const PRIMARY =
  'rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50';
const SECONDARY =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

/**
 * Writes the replies for the jobs that have none, with one Claude chat: copy one prompt for up
 * to 5 jobs, then paste Claude's whole reply back and each job gets its own part.
 */
function WriteAll({ waiting, onSaved }: { waiting: number; onSaved: (note: string) => void }) {
  const errorText = useErrorText();
  const t = useTranslations('Jobs.queue');
  const prompt = useApplyQueuePrompt();
  const save = useSaveApplyQueueReply();
  const [note, setNote] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const data = prompt.data;
  const count = data?.jobIds.length ?? 0;
  const jobs = t('jobs', { count });

  const copyAndOpen = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setNote(t('copied', { jobs }));
    } catch {
      setNote(t('copyFailed'));
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
        onSaved(t('savedReplies', { done: before - left, total: before }));
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
        {waiting > count && count > 0
          ? t('waitingMore', { count: waiting, now: count })
          : t('waiting', { count: waiting })}
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
          {count > 0 ? t('copyButton', { jobs }) : t('copyButtonAll')}
        </button>
        <button
          type="button"
          className={SECONDARY}
          disabled={save.isPending || !data?.prompt}
          onClick={() => {
            void pasteFromClipboard();
          }}
        >
          {save.isPending ? t('saving') : t('pasteButton')}
        </button>
        <button
          type="button"
          className={LINK}
          aria-expanded={pasting}
          onClick={() => {
            setPasting((open) => !open);
          }}
        >
          {t('pasteYourself')}
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
            aria-label={t('replyBox')}
            placeholder={t('replyPlaceholder')}
            rows={6}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-slate-900"
          />
          <button type="submit" className={PRIMARY} disabled={save.isPending || !text.trim()}>
            {t('saveReplies')}
          </button>
        </form>
      )}
      {data?.prompt && (
        <details>
          <summary className="cursor-pointer text-xs">{t('showPrompt')}</summary>
          <textarea
            readOnly
            value={data.prompt}
            aria-label={t('promptForJobs')}
            rows={8}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700"
          />
        </details>
      )}
      {(prompt.isError || save.isError) && (
        <p role="alert" className="text-red-700">
          {save.isError
            ? t('saveError', { error: errorText(save.error) })
            : t('promptError', { error: errorText(prompt.error) })}
        </p>
      )}
    </div>
  );
}

/**
 * The jobs you lined up to apply for. One Claude in Chrome prompt fills in every form (it stops
 * before Submit on each), then you check each tab, send it and mark the job Applied here.
 *
 * It lives in a chat-style window in the corner of the page: a round button with the number of
 * queued jobs on it opens it, and it can be made full-screen.
 */
export function ApplyQueuePanel({
  onOpenJob,
  queueOnly = false,
  onToggleQueueOnly,
}: {
  onOpenJob: (jobId: string) => void;
  /** True while the table shows only the queued jobs. */
  queueOnly?: boolean;
  onToggleQueueOnly?: (() => void) | undefined;
}) {
  const errorText = useErrorText();
  const t = useTranslations('Jobs.queue');
  const queue = useApplyQueue();
  const change = useChangeApplyQueue();
  const move = useMoveInApplyQueue();
  const updateStatus = useUpdateJobStatus();
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const items = queue.data ?? [];

  const notReady = items.filter((item) => !item.ready).length;
  // Marking a job Applied takes it out of the queue on the server; the status change refreshes it.
  const markApplied = (list: ApplyQueueItem[]) => {
    for (const item of list) updateStatus.mutate({ id: item.jobId, status: 'APPLIED' });
  };

  const badge = items.length > 99 ? '99+' : String(items.length);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={t('open', { count: items.length })}
        title={t('openHint')}
        className="fixed right-4 bottom-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl ring-2 ring-white hover:bg-slate-800"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
          <path d="m9 11.5 2 2 4-4" />
        </svg>
        {items.length > 0 && (
          <span
            aria-hidden="true"
            className={`absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold tabular-nums ring-2 ring-white ${
              notReady > 0 ? 'bg-amber-400 text-slate-900' : 'bg-emerald-500 text-white'
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <section
      aria-labelledby="apply-queue-heading"
      className={`fixed z-40 flex flex-col overflow-hidden border border-slate-200 bg-white text-sm shadow-2xl ${
        maximized
          ? 'inset-3 rounded-2xl'
          : 'right-3 bottom-3 max-h-[80dvh] w-[calc(100vw-1.5rem)] rounded-2xl sm:w-[26rem]'
      }`}
    >
      <div className="flex items-center gap-2 bg-slate-900 px-3 py-2.5 text-white">
        <h2 id="apply-queue-heading" className="mr-auto text-sm font-semibold">
          {t('heading', { count: items.length })}
        </h2>
        <button
          type="button"
          aria-label={maximized ? t('restore') : t('maximize')}
          title={maximized ? t('restore') : t('maximize')}
          onClick={() => {
            setMaximized((m) => !m);
          }}
          className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          {maximized ? '⤡' : '⤢'}
        </button>
        <button
          type="button"
          aria-label={t('close')}
          title={t('close')}
          onClick={() => {
            setOpen(false);
            setMaximized(false);
          }}
          className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {items.length === 0 && <p className="text-slate-600">{t('empty')}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <a href={APPLY_QUEUE_URL} target="_blank" rel="noreferrer" className={LINK}>
            {t('openPage')}
          </a>
          {onToggleQueueOnly && (
            <button
              type="button"
              aria-pressed={queueOnly}
              onClick={onToggleQueueOnly}
              className={queueOnly ? `${LINK} font-semibold` : LINK}
            >
              {queueOnly ? t('showAllJobs') : t('showInTable')}
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                markApplied(items);
              }}
              className="ml-auto rounded-md bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700"
            >
              {t('markAll')}
            </button>
          )}
        </div>
        {notReady > 0 && <WriteAll waiting={notReady} onSaved={setSavedNote} />}
        {savedNote && (
          <p role="status" className="text-emerald-700">
            ✓ {savedNote}
          </p>
        )}
        <ol className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <li key={item.jobId} className="py-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 tabular-nums"
                >
                  {item.number}
                </span>
                <span className="flex flex-col">
                  <button
                    type="button"
                    disabled={index === 0 || move.isPending}
                    onClick={() => {
                      move.mutate({ jobId: item.jobId, direction: 'UP' });
                    }}
                    aria-label={t('moveUp', { title: item.title })}
                    title={t('moveUpHint')}
                    className="h-3.5 px-1 text-[10px] leading-none text-slate-500 hover:text-slate-900 disabled:opacity-25"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1 || move.isPending}
                    onClick={() => {
                      move.mutate({ jobId: item.jobId, direction: 'DOWN' });
                    }}
                    aria-label={t('moveDown', { title: item.title })}
                    title={t('moveDownHint')}
                    className="h-3.5 px-1 text-[10px] leading-none text-slate-500 hover:text-slate-900 disabled:opacity-25"
                  >
                    ▼
                  </button>
                </span>
                <span className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenJob(item.jobId);
                    }}
                    title={t('openJob')}
                    className="text-left font-medium text-slate-900 hover:text-brand-700 hover:underline"
                  >
                    {item.title}
                  </button>{' '}
                  <span className="text-slate-500">{t('at', { company: item.company })}</span>
                </span>
                <span
                  className={
                    item.ready
                      ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
                      : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800'
                  }
                >
                  {item.ready ? t('ready') : t('needsReply')}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 pl-9">
                <a
                  href={applyKitUrl(item.jobId)}
                  target="_blank"
                  rel="noreferrer"
                  className={LINK}
                  aria-label={t('kitLabel', { title: item.title })}
                >
                  {t('kit')}
                </a>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={LINK}
                    aria-label={t('postingLabel', { title: item.title })}
                  >
                    {t('posting')}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    markApplied([item]);
                  }}
                  className="rounded-md px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-50"
                  aria-label={t('appliedLabel', { title: item.title })}
                >
                  {t('applied')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    change.mutate({ jobIds: [item.jobId], remove: true });
                  }}
                  className="px-1 text-slate-400 hover:text-slate-700"
                  aria-label={t('remove', { title: item.title })}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
        {items.length > 0 && (
          <CopyText
            primary
            label={t('copyPrompt')}
            text={queuePrompt(items.length)}
            copiedHint={t('copiedHint')}
            boxLabel={t('promptBox')}
          />
        )}
        {(change.isError || move.isError || updateStatus.isError) && (
          <p role="alert" className="text-red-700">
            {t('changeError', {
              error: errorText(change.error ?? move.error ?? updateStatus.error),
            })}
          </p>
        )}
      </div>
    </section>
  );
}
