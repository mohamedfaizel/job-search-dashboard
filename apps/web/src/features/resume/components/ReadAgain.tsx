import type { ResumeBuild } from '@jobsearch/data';
import { useRestartResumeBuild, useResumeBuildPrompt } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { InfoTip } from '../../../components/InfoTip';
import { Popover } from '../../../components/Popover';
import { useErrorText } from '../../../i18n/useErrorText';
import { useAiChat } from '../../../lib/ai-chat';
import { FIELD, SMALL_BUTTON } from './ui';

/** After a new upload: read the new file into sections again, or keep the builder's version. */
export function ReadAgain({
  language,
  outOfDate,
  onRead,
  onKeep,
}: {
  language: string;
  /** The resume on My profile changed since the builder read it (a new upload). */
  outOfDate: boolean;
  onRead: (build: ResumeBuild) => void;
  /** Saves the builder's version over My profile instead. */
  onKeep: () => void;
}) {
  const t = useTranslations('Resume.readAgain');
  const errorText = useErrorText();
  const restart = useRestartResumeBuild();
  if (!outOfDate) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
    >
      <span className="min-w-0 flex-1">{t('outOfDate')}</span>
      <button
        type="button"
        className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        disabled={restart.isPending}
        onClick={() => {
          restart.mutate({ language }, { onSuccess: onRead });
        }}
      >
        {t('readNew')}
      </button>
      <button type="button" className={SMALL_BUTTON} onClick={onKeep}>
        {t('keepMine')}
      </button>
      {restart.isError && (
        <p role="alert" className="w-full text-sm text-red-700">
          {errorText(restart.error)}
        </p>
      )}
    </div>
  );
}

const STEP =
  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] text-white';
const BIG =
  'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold disabled:opacity-50';
const SMALL =
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium disabled:opacity-50';

/**
 * "✦ Sort with my AI chat" at the top of the Resume page: a dropdown with two steps. Copy the
 * prompt (your AI chat opens), then paste its reply: it is applied at once and Undo brings the
 * old resume back. "Edit the reply" shows the reply as text; "Start again from My profile" reads
 * the resume from My profile without the AI chat. The yellow ✦ marks a prompt you paste into
 * your AI chat yourself, at no cost here.
 */
export function SortWithAi({
  language,
  onRead,
  onUndo,
}: {
  language: string;
  onRead: (build: ResumeBuild) => void;
  onUndo: () => void;
}) {
  const t = useTranslations('Resume.readAgain');
  const errorText = useErrorText();
  const chat = useAiChat();
  const restart = useRestartResumeBuild();
  const prompt = useResumeBuildPrompt(language);
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const [clipboardFailed, setClipboardFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [applied, setApplied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const replyId = useId();

  const read = (vars: { language: string; reply?: string }) => {
    setApplied(false);
    restart.mutate(vars, {
      onSuccess: (build) => {
        setConfirm(false);
        setApplied(!!vars.reply);
        onRead(build);
      },
    });
  };

  const copyPrompt = async () => {
    setCopied(null);
    const { data } = await prompt.refetch();
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
    window.open(chat.url, '_blank', 'noopener');
  };

  // Pasting applies the reply straight away; without clipboard access the text box opens.
  const pasteAndApply = async () => {
    setClipboardFailed(false);
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setClipboardFailed(true);
      setEditing(true);
      return;
    }
    setReply(text);
    if (text.trim()) read({ language, reply: text });
    else setEditing(true);
  };

  return (
    <Popover
      align="right"
      label={
        <>
          <span className="font-bold text-amber-600" aria-hidden>
            ✦{' '}
          </span>
          {t('sortWithAi')}
        </>
      }
      buttonClass={SMALL_BUTTON}
      panelClass="w-[min(26rem,92vw)] space-y-2"
    >
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-slate-900">{t('title')}</h3>
        <InfoTip label={t('aboutTitle')} text={t('stepHint')} />
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden className={STEP}>
          1
        </span>
        <button
          type="button"
          className={`${BIG} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}
          disabled={prompt.isFetching}
          onClick={() => {
            void copyPrompt();
          }}
        >
          <span aria-hidden>📋</span>
          {prompt.isFetching ? t('gettingPrompt') : t('copyPrompt', { ai: chat.name })}
          <span aria-hidden className="ml-auto text-slate-500">
            ↗
          </span>
        </button>
      </div>
      {copied && (
        <p role="status" className="pl-7 text-xs text-slate-600">
          {copied === 'yes' ? t('copied', { ai: chat.name }) : t('copyFailed')}
        </p>
      )}
      <div className="flex items-center gap-2">
        <span aria-hidden className={STEP}>
          2
        </span>
        <button
          type="button"
          className={`${BIG} bg-brand-600 text-white hover:bg-brand-700`}
          disabled={restart.isPending}
          onClick={() => {
            void pasteAndApply();
          }}
        >
          <span aria-hidden>📥</span>
          {restart.isPending ? t('reading') : t('pasteReply', { ai: chat.name })}
          <span className="ml-auto text-xs font-normal opacity-85">{t('appliesItself')}</span>
        </button>
        {applied && (
          <button
            type="button"
            className={`${SMALL} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
            onClick={() => {
              setApplied(false);
              onUndo();
            }}
          >
            ↶ {t('undo')}
          </button>
        )}
      </div>
      {applied && (
        <p role="status" className="pl-7 text-xs text-emerald-700">
          {t('applied')}
        </p>
      )}
      {clipboardFailed && (
        <p role="status" className="pl-7 text-xs text-amber-800">
          {t('clipboardFailed')}
        </p>
      )}
      {editing && (
        <div className="space-y-1.5 border-t border-slate-200 pt-2">
          <label htmlFor={replyId} className="block text-xs font-medium text-slate-700">
            {t('paste', { ai: chat.name })}
          </label>
          <textarea
            id={replyId}
            rows={5}
            value={reply}
            onChange={(event) => {
              setReply(event.target.value);
            }}
            className={`${FIELD} font-mono text-xs`}
          />
          <button
            type="button"
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            disabled={restart.isPending || !reply.trim()}
            onClick={() => {
              read({ language, reply });
            }}
          >
            {t('apply')}
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-2">
        <button
          type="button"
          aria-expanded={editing}
          className={`${SMALL} border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100`}
          onClick={() => {
            setEditing((e) => !e);
          }}
        >
          ✎ {t('editReply')}
        </button>
        {confirm ? (
          <div
            role="alertdialog"
            aria-label={t('startAgain')}
            className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600"
          >
            <span>{t('confirm')}</span>
            <button
              type="button"
              className="rounded-md bg-red-700 px-2 py-1 font-medium text-white hover:bg-red-800 disabled:opacity-50"
              disabled={restart.isPending}
              onClick={() => {
                read({ language });
              }}
            >
              {t('yes')}
            </button>
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() => {
                setConfirm(false);
              }}
            >
              {t('no')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={`${SMALL} border-slate-300 bg-white text-slate-600 hover:bg-slate-50`}
            onClick={() => {
              setConfirm(true);
            }}
          >
            ↻ {t('startAgain')}
          </button>
        )}
      </div>
      {restart.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(restart.error)}
        </p>
      )}
    </Popover>
  );
}
