import type { ResumeBuild } from '@jobsearch/data';
import { useRestartResumeBuild, useResumeBuildPrompt } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useAiChat } from '../../../lib/ai-chat';
import { FIELD, SMALL_BUTTON } from './ui';

interface Props {
  language: string;
  /** The resume on My profile changed since the builder read it (a new upload). */
  outOfDate: boolean;
  onRead: (build: ResumeBuild) => void;
  /** Saves the builder's version over My profile instead. */
  onKeep: () => void;
}

/**
 * Reading the resume into sections again. After a new upload the builder asks first. The
 * rules can't tell a job title from a bullet in plain text; the AI chat way can (the yellow ✦
 * marks a prompt you paste into your AI chat yourself, at no cost here).
 */
export function ReadAgain({ language, outOfDate, onRead, onKeep }: Props) {
  const t = useTranslations('Resume.readAgain');
  const errorText = useErrorText();
  const chat = useAiChat();
  const restart = useRestartResumeBuild();
  const prompt = useResumeBuildPrompt(language);
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const replyId = useId();

  const read = (vars: { language: string; reply?: string }) => {
    restart.mutate(vars, {
      onSuccess: (build) => {
        setReply('');
        setConfirm(false);
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
      <details className="group rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">{t('title')}</summary>
        <div className="mt-3 space-y-4">
          <div className="space-y-2">
            <p className="text-slate-600">{t('fromProfile')}</p>
            {confirm ? (
              <div
                role="alertdialog"
                aria-label={t('fromProfileButton')}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="text-xs text-slate-600">{t('confirm')}</span>
                <button
                  type="button"
                  className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                  disabled={restart.isPending}
                  onClick={() => {
                    read({ language });
                  }}
                >
                  {t('confirmYes')}
                </button>
                <button
                  type="button"
                  className={SMALL_BUTTON}
                  onClick={() => {
                    setConfirm(false);
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={SMALL_BUTTON}
                onClick={() => {
                  setConfirm(true);
                }}
              >
                {t('fromProfileButton')}
              </button>
            )}
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-slate-600">
              <span className="font-bold text-amber-600" aria-hidden>
                ✦{' '}
              </span>
              {t('withAi')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
            <label htmlFor={replyId} className="block text-xs font-medium text-slate-600">
              {t('paste')}
            </label>
            <textarea
              id={replyId}
              rows={4}
              value={reply}
              onChange={(event) => {
                setReply(event.target.value);
              }}
              className={`${FIELD} font-mono text-xs [field-sizing:fixed]`}
            />
            <button
              type="button"
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              disabled={restart.isPending || !reply.trim()}
              onClick={() => {
                read({ language, reply });
              }}
            >
              {restart.isPending ? t('reading') : t('readReply')}
            </button>
          </div>
          {restart.isError && (
            <p role="alert" className="text-sm text-red-700">
              {errorText(restart.error)}
            </p>
          )}
        </div>
      </details>
    </>
  );
}
