import type { FactFinding } from '@jobsearch/data';
import { useMyApiKeys } from '@jobsearch/data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useAiChat } from '../../../lib/ai-chat';
import { lineDiff } from '../docOps';
import { TickIcon, XIcon } from './icons';
import { FIELD, SMALL_BUTTON } from './ui';

/** What a suggestion looks like to the flow: the text before and after, and what to check. */
export interface Suggestion<T> {
  before: string;
  after: string;
  findings: FactFinding[];
  /** What Keep hands back (a section, or the letter's text). */
  value: T;
}

interface Props<T> {
  /** Heading and one-line hint, for a section or for the letter. */
  title: string;
  hint: string;
  /** The prompt to copy into your AI chat. */
  getPrompt: (instruction: string) => Promise<string>;
  /** A suggestion from the pasted reply, or (null) from your own saved key. */
  run: (instruction: string, reply: string | null) => Promise<Suggestion<T>>;
  /** Keep: the suggestion goes into the resume (one undo step). */
  onKeep: (value: T) => void;
  onClose: () => void;
}

const LINE_STYLE = {
  same: 'text-slate-600',
  removed: 'bg-red-50 text-red-900 line-through decoration-red-300',
  added: 'bg-emerald-50 text-emerald-950',
} as const;

/**
 * Improve one section with AI. Two ways to get a suggestion: copy a prompt into your AI chat and
 * paste its reply (the yellow ✦: free here), or let your own saved key answer (the purple ✦: it
 * uses your credits). Either way nothing changes until you keep it: the suggestion is shown as a
 * before-and-after, with the facts that are not in anything you told us flagged.
 */
export function ImproveFlow<T>({ title, hint, getPrompt, run, onKeep, onClose }: Props<T>) {
  const t = useTranslations('Resume.improve');
  const errorText = useErrorText();
  const chat = useAiChat();
  const keys = useMyApiKeys();
  const [pending, setPending] = useState<'prompt' | 'key' | 'reply' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [instruction, setInstruction] = useState('');
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion<T> | null>(null);
  const fieldId = useId();
  const replyId = useId();
  const hasKey = (keys.data ?? []).some((k) => k.kind === 'ANTHROPIC' || k.kind === 'OPENAI');

  const ask = (pasted: string | null) => {
    setPending(pasted === null ? 'key' : 'reply');
    setError(null);
    run(instruction.trim(), pasted)
      .then(setSuggestion)
      .catch((e: unknown) => {
        setError(e);
      })
      .finally(() => {
        setPending(null);
      });
  };

  const copyPrompt = async () => {
    setCopied(null);
    setPending('prompt');
    setError(null);
    const text = await getPrompt(instruction.trim()).catch((e: unknown) => {
      setError(e);
      return null;
    });
    setPending(null);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
    window.open(chat.url, '_blank', 'noopener');
  };

  if (suggestion) {
    const flagged = suggestion.findings;
    return (
      <div
        role="region"
        aria-label={t('changes')}
        className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
      >
        <div className="flex items-center gap-2">
          <h3 className="mr-auto text-sm font-semibold text-slate-900">{t('changes')}</h3>
          <button
            type="button"
            title={t('keep')}
            aria-label={t('keep')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-700 text-white hover:bg-emerald-800"
            onClick={() => {
              onKeep(suggestion.value);
              onClose();
            }}
          >
            <TickIcon />
          </button>
          <button
            type="button"
            title={t('discard')}
            aria-label={t('discard')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-700 text-white hover:bg-red-800"
            onClick={onClose}
          >
            <XIcon />
          </button>
        </div>
        <ul aria-label={t('diff')} className="space-y-0.5 font-mono text-xs">
          {lineDiff(suggestion.before, suggestion.after).map((line, index) => (
            <li
              // The same line can repeat, so the position is part of its identity.
              key={`${String(index)}-${line.text}`}
              className={`rounded px-1.5 py-0.5 whitespace-pre-wrap ${LINE_STYLE[line.kind]}`}
            >
              <span className="sr-only">{t(`line.${line.kind}`)} </span>
              {line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '− ' : '  '}
              {line.text}
            </li>
          ))}
        </ul>
        {flagged.length > 0 ? (
          <div
            role="alert"
            className="space-y-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-300 ring-inset"
          >
            <p className="font-semibold">{t('flagged', { count: flagged.length })}</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {flagged.map((f) => (
                <li key={`${f.kind}-${f.text}-${f.context}`}>
                  <strong>{f.text}</strong> <span className="text-amber-800">{f.context}</span>
                </li>
              ))}
            </ul>
            <p>{t('flaggedHint')}</p>
          </div>
        ) : (
          <p role="status" className="text-xs text-emerald-800">
            ✓ {t('factsOk')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={title}
      className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
    >
      <div className="flex items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          title={t('close')}
          aria-label={t('close')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200"
          onClick={onClose}
        >
          <XIcon />
        </button>
      </div>
      <p className="text-xs text-slate-600">{hint}</p>
      <div className="space-y-1">
        <label htmlFor={fieldId} className="block text-xs font-medium text-slate-600">
          {t('instruction')}
        </label>
        <input
          id={fieldId}
          value={instruction}
          placeholder={t('instructionExample')}
          onChange={(event) => {
            setInstruction(event.target.value);
          }}
          className={FIELD}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={pending === 'prompt'}
          onClick={() => {
            void copyPrompt();
          }}
        >
          <span className="font-bold text-amber-600" aria-hidden>
            ✦{' '}
          </span>
          {pending === 'prompt' ? t('gettingPrompt') : t('copyPrompt')}
        </button>
        {copied && (
          <span role="status" className="text-xs text-slate-600">
            {copied === 'yes' ? t('copied') : t('copyFailed')}
          </span>
        )}
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={!hasKey || pending !== null}
          title={hasKey ? t('withKeyHint') : t('noKey')}
          onClick={() => {
            ask(null);
          }}
        >
          <span className="font-bold text-purple-600" aria-hidden>
            ✦{' '}
          </span>
          {pending === 'key' ? t('asking') : t('withKey')}
        </button>
        {!hasKey && (
          <Link href="/settings" className="text-xs font-medium text-slate-600 underline">
            {t('addKey')}
          </Link>
        )}
      </div>
      <div className="space-y-1">
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
          disabled={pending !== null || !reply.trim()}
          onClick={() => {
            ask(reply);
          }}
        >
          {pending === 'reply' ? t('reading') : t('showChanges')}
        </button>
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(error)}
        </p>
      )}
    </div>
  );
}
