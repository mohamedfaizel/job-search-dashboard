import type { ResumeBuild } from '@jobsearch/data';
import { useRestartResumeBuild, useResumeBuildPrompt } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useAiChat } from '../../../lib/ai-chat';
import { RefreshIcon, TickIcon, XIcon } from './icons';
import { FIELD, ICON_BUTTON, SMALL_BUTTON } from './ui';

interface Props {
  language: string;
  /** The resume on My profile changed since the builder read it (a new upload). */
  outOfDate: boolean;
  onRead: (build: ResumeBuild) => void;
  /** Saves the builder's version over My profile instead. */
  onKeep: () => void;
}

/** A numbered step that turns green when it is done. */
function Step({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`grid content-start gap-1.5 rounded-lg border p-2 ${
        done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
        <span
          aria-hidden
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white ${
            done ? 'bg-emerald-600' : 'bg-brand-600'
          }`}
        >
          {done ? <TickIcon /> : n}
        </span>
        {title}
      </span>
      {children}
    </li>
  );
}

/**
 * Where the resume comes from. ↻ starts again from the text on My profile (sections are found
 * by their titles); "Sort with my AI chat" is the better way: your chat sorts jobs, dates and
 * bullets into the right places (the yellow ✦ marks a prompt you paste into your AI chat
 * yourself, at no cost here). After a new upload the bar asks first.
 */
export function ReadAgain({ language, outOfDate, onRead, onKeep }: Props) {
  const t = useTranslations('Resume.readAgain');
  const errorText = useErrorText();
  const chat = useAiChat();
  const restart = useRestartResumeBuild();
  const prompt = useResumeBuildPrompt(language);
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const [clipboardFailed, setClipboardFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState(false);
  const replyId = useId();
  const panelId = useId();

  const read = (vars: { language: string; reply?: string }) => {
    restart.mutate(vars, {
      onSuccess: (build) => {
        setReply('');
        setConfirm(false);
        setOpen(false);
        setCopied(null);
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

  const pasteFromClipboard = async () => {
    setClipboardFailed(false);
    try {
      setReply(await navigator.clipboard.readText());
    } catch {
      setClipboardFailed(true);
    }
  };

  return (
    <>
      {outOfDate && (
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
              read({ language });
            }}
          >
            {t('readNew')}
          </button>
          <button type="button" className={SMALL_BUTTON} onClick={onKeep}>
            {t('keepMine')}
          </button>
        </div>
      )}
      <section
        aria-label={t('title')}
        className="space-y-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-sm font-medium text-slate-700">{t('title')}</h3>
          {confirm ? (
            <div
              role="alertdialog"
              aria-label={t('startAgain')}
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className="text-xs text-slate-600">{t('confirm')}</span>
              <button
                type="button"
                className={`${ICON_BUTTON} text-emerald-700`}
                disabled={restart.isPending}
                aria-label={t('yes')}
                title={t('yes')}
                onClick={() => {
                  read({ language });
                }}
              >
                <TickIcon />
              </button>
              <button
                type="button"
                className={`${ICON_BUTTON} text-red-700 hover:bg-red-50 hover:text-red-800`}
                aria-label={t('no')}
                title={t('no')}
                onClick={() => {
                  setConfirm(false);
                }}
              >
                <XIcon />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={t('startAgain')}
              title={t('startAgain')}
              onClick={() => {
                setConfirm(true);
              }}
            >
              <RefreshIcon />
            </button>
          )}
          <button
            type="button"
            className={SMALL_BUTTON}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => {
              setOpen((o) => !o);
            }}
          >
            <span className="font-bold text-amber-600" aria-hidden>
              ✦{' '}
            </span>
            {t('sortWithAi')}
          </button>
        </div>
        {open && (
          <div id={panelId} className="space-y-2">
            <p className="text-xs text-slate-500">{t('stepHint')}</p>
            <ol className="grid gap-2 sm:grid-cols-3">
              <Step n={1} done={copied === 'yes'} title={t('step1')}>
                <button
                  type="button"
                  className={SMALL_BUTTON}
                  disabled={prompt.isFetching}
                  onClick={() => {
                    void copyPrompt();
                  }}
                >
                  {prompt.isFetching ? t('gettingPrompt') : t('copyPrompt')}
                </button>
                {copied && (
                  <span role="status" className="text-xs text-slate-600">
                    {copied === 'yes' ? t('copied') : t('copyFailed')}
                  </span>
                )}
              </Step>
              <Step n={2} done={!!reply.trim()} title={t('step2', { ai: chat.name })}>
                <button
                  type="button"
                  className={SMALL_BUTTON}
                  onClick={() => {
                    void pasteFromClipboard();
                  }}
                >
                  {t('pasteClipboard')}
                </button>
                <label htmlFor={replyId} className="sr-only">
                  {t('paste', { ai: chat.name })}
                </label>
                <textarea
                  id={replyId}
                  rows={2}
                  value={reply}
                  onChange={(event) => {
                    setReply(event.target.value);
                  }}
                  className={`${FIELD} font-mono text-xs [field-sizing:fixed]`}
                />
                {clipboardFailed && (
                  <span role="status" className="text-xs text-amber-800">
                    {t('clipboardFailed')}
                  </span>
                )}
              </Step>
              <Step n={3} done={false} title={t('step3')}>
                <button
                  type="button"
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  disabled={restart.isPending || !reply.trim()}
                  onClick={() => {
                    read({ language, reply });
                  }}
                >
                  {restart.isPending ? t('reading') : t('apply')}
                </button>
              </Step>
            </ol>
          </div>
        )}
        {restart.isError && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(restart.error)}
          </p>
        )}
      </section>
    </>
  );
}
