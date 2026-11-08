import type { BuilderSection, SectionSuggestion } from '@jobsearch/data';
import { useImproveSection, useImproveSectionPrompt, useMyApiKeys } from '@jobsearch/data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useAiChat } from '../../../lib/ai-chat';
import { lineDiff } from '../docOps';
import { TickIcon, XIcon } from './icons';
import { FIELD, SMALL_BUTTON } from './ui';

interface Props {
  section: BuilderSection;
  /** The job whose copy this is; null for your master resume. */
  jobId: string | null;
  language: string;
  /** Keep: the improved section goes into the resume (one undo step). */
  onKeep: (section: BuilderSection) => void;
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
export function ImprovePanel({ section, jobId, language, onKeep, onClose }: Props) {
  const t = useTranslations('Resume.improve');
  const errorText = useErrorText();
  const chat = useAiChat();
  const keys = useMyApiKeys();
  const promptFor = useImproveSectionPrompt();
  const improve = useImproveSection();
  const [instruction, setInstruction] = useState('');
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const [suggestion, setSuggestion] = useState<SectionSuggestion | null>(null);
  const fieldId = useId();
  const replyId = useId();
  const hasKey = (keys.data ?? []).some((k) => k.kind === 'ANTHROPIC' || k.kind === 'OPENAI');

  const input = () => ({
    sectionId: section.id,
    jobId,
    language,
    instruction: instruction.trim() || null,
  });

  const ask = (pasted: string | null) => {
    improve.mutate({ ...input(), reply: pasted }, { onSuccess: setSuggestion });
  };

  const copyPrompt = async () => {
    setCopied(null);
    const text = await promptFor.mutateAsync(input()).catch(() => null);
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
              onKeep(JSON.parse(suggestion.section) as BuilderSection);
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
      aria-label={t('title')}
      className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
    >
      <div className="flex items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold text-slate-900">{t('title')}</h3>
        <button
          type="button"
          title={t('close')}
          aria-label={t('close')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200"
          onClick={onClose}
        >
          <XIcon />
        </button>
      </div>
      <p className="text-xs text-slate-600">{t('hint')}</p>
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
          disabled={promptFor.isPending}
          onClick={() => {
            void copyPrompt();
          }}
        >
          <span className="font-bold text-amber-600" aria-hidden>
            ✦{' '}
          </span>
          {promptFor.isPending ? t('gettingPrompt') : t('copyPrompt')}
        </button>
        {copied && (
          <span role="status" className="text-xs text-slate-600">
            {copied === 'yes' ? t('copied') : t('copyFailed')}
          </span>
        )}
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={!hasKey || improve.isPending}
          title={hasKey ? t('withKeyHint') : t('noKey')}
          onClick={() => {
            ask(null);
          }}
        >
          <span className="font-bold text-purple-600" aria-hidden>
            ✦{' '}
          </span>
          {improve.isPending && !reply ? t('asking') : t('withKey')}
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
          disabled={improve.isPending || !reply.trim()}
          onClick={() => {
            ask(reply);
          }}
        >
          {improve.isPending && reply ? t('reading') : t('showChanges')}
        </button>
      </div>
      {(improve.isError || promptFor.isError) && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(improve.error ?? promptFor.error)}
        </p>
      )}
    </div>
  );
}
