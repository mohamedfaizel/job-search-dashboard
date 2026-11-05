import type { JobResume } from '@jobsearch/data';
import { useEditJobResume } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import type { ReplyLine } from '../replyEdit';
import {
  deleteLine,
  insertLine,
  lineLike,
  readLine,
  replaceLine,
  rewordLine,
  splitLines,
} from '../replyEdit';

const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export type ReplyPart = 'resume' | 'coverLetter' | 'formAnswers';
export type ReplyDraft = Record<ReplyPart, string>;

const fromSaved = (saved: JobResume): ReplyDraft => ({
  resume: saved.text,
  coverLetter: saved.coverLetter,
  formAnswers: saved.formAnswers,
});

/**
 * Your edits to the saved reply, not yet saved: every change can be undone one by one, and
 * Reset goes back to what is saved. Remount (key on updatedAt) to start from a new save.
 */
export function useReplyDraft(saved: JobResume) {
  const [draft, setDraft] = useState<ReplyDraft>(() => fromSaved(saved));
  const [history, setHistory] = useState<ReplyDraft[]>([]);
  const original = fromSaved(saved);
  const dirty = (Object.keys(original) as ReplyPart[]).some(
    (part) => draft[part].trim() !== original[part].trim(),
  );
  return {
    draft,
    dirty,
    canUndo: history.length > 0,
    change: (part: ReplyPart, text: string) => {
      if (text === draft[part]) return;
      setHistory((h) => [...h, draft]);
      setDraft({ ...draft, [part]: text });
    },
    undo: () => {
      const previous = history.at(-1);
      if (!previous) return;
      setHistory((h) => h.slice(0, -1));
      setDraft(previous);
    },
    reset: () => {
      setHistory((h) => [...h, draft]);
      setDraft(original);
    },
  };
}
export type ReplyDraftState = ReturnType<typeof useReplyDraft>;

const LINE_STYLE: Record<ReplyLine['kind'], string> = {
  name: 'text-xl font-bold text-slate-900',
  section:
    'mt-3 border-b border-slate-300 pb-0.5 text-xs font-semibold tracking-wider text-slate-800 uppercase',
  entry: 'mt-1.5 font-semibold text-slate-900',
  bullet: 'pl-4 text-slate-700',
  text: 'text-slate-700',
  blank: 'h-2',
};

/** One line being changed: Enter saves, Shift+Enter starts a new line, Escape cancels. */
function LineEditor({
  value,
  onSave,
  onCancel,
  onAddBelow,
  onDelete,
}: {
  value: string;
  onSave: (words: string) => void;
  onCancel: () => void;
  onAddBelow: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('Jobs.preview');
  const [words, setWords] = useState(value);
  return (
    <div className="my-1 space-y-1.5 rounded-lg bg-brand-50 p-2 ring-1 ring-brand-200">
      <textarea
        // The user clicked this line to change it, so the box takes the focus.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={words}
        aria-label={t('lineBox')}
        rows={Math.max(1, Math.ceil(words.length / 70))}
        onChange={(e) => {
          setWords(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSave(words);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <button
          type="button"
          className="rounded-md bg-brand-600 px-2 py-1 font-medium text-white hover:bg-brand-700"
          onClick={() => {
            onSave(words);
          }}
        >
          {t('lineDone')}
        </button>
        <button type="button" className="text-slate-600 hover:underline" onClick={onCancel}>
          {t('lineCancel')}
        </button>
        <button type="button" className="text-brand-700 hover:underline" onClick={onAddBelow}>
          {t('lineAdd')}
        </button>
        <button type="button" className="text-red-700 hover:underline" onClick={onDelete}>
          {t('lineDelete')}
        </button>
      </div>
    </div>
  );
}

/**
 * The text shown like a page: click any line to change it in place. Lines keep their Markdown
 * marks (# heading, - bullet) so the PDF templates lay them out the same way.
 */
function PageView({
  text,
  onChange,
  label,
}: {
  text: string;
  onChange: (text: string) => void;
  label: string;
}) {
  const t = useTranslations('Jobs.preview');
  const [editing, setEditing] = useState<number | null>(null);
  const lines = splitLines(text);
  return (
    <div
      role="group"
      aria-label={label}
      className="max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm leading-relaxed shadow-sm sm:px-8 sm:py-6"
    >
      {lines.map((raw, i) => {
        const line = readLine(raw);
        if (editing === i) {
          return (
            <LineEditor
              key={i}
              value={line.text}
              onSave={(words) => {
                onChange(
                  words.trim() ? replaceLine(text, i, rewordLine(raw, words)) : deleteLine(text, i),
                );
                setEditing(null);
              }}
              onCancel={() => {
                setEditing(null);
              }}
              onAddBelow={() => {
                onChange(insertLine(text, i, lineLike(raw, '')));
                setEditing(i + 1);
              }}
              onDelete={() => {
                onChange(deleteLine(text, i));
                setEditing(null);
              }}
            />
          );
        }
        if (line.kind === 'blank') return <div key={i} aria-hidden="true" className="h-2" />;
        return (
          <button
            key={i}
            type="button"
            title={t('clickToEdit')}
            onClick={() => {
              setEditing(i);
            }}
            className={`block w-full cursor-text rounded px-1 -mx-1 text-left hover:bg-amber-50 hover:ring-1 hover:ring-amber-200 ${LINE_STYLE[line.kind]}`}
          >
            {line.kind === 'bullet' && (
              <span aria-hidden="true" className="-ml-3 mr-1.5 inline-block w-1.5 text-slate-500">
                •
              </span>
            )}
            {line.text}
          </button>
        );
      })}
      {text.trim() === '' && <p className="text-slate-500">{t('empty')}</p>}
    </div>
  );
}

/** The preview with its own draft, started again from every new save. */
export function SavedReplyPreview({ jobId, saved }: { jobId: string; saved: JobResume }) {
  const state = useReplyDraft(saved);
  return <ReplyPreview jobId={jobId} state={state} />;
}

/**
 * Claude's reply after you saved it, as it will read: the resume like a page, the cover letter
 * and form answers next to it. Click a line to change it, or edit the whole text; Undo, Reset
 * and Save changes. Saving scores the resume again and the PDF follows it.
 */
export function ReplyPreview({ jobId, state }: { jobId: string; state: ReplyDraftState }) {
  const t = useTranslations('Jobs.preview');
  const errorText = useErrorText();
  const save = useEditJobResume();
  const { draft, dirty } = state;
  const [part, setPart] = useState<ReplyPart>('resume');
  const [asText, setAsText] = useState(false);
  // The cover letter and form answers get a tab when the reply has them.
  const parts = (['resume', 'coverLetter', 'formAnswers'] as const).filter(
    (p) => p === 'resume' || p === part || draft[p].trim() !== '',
  );
  const shown = part;

  return (
    <section
      aria-label={t('title')}
      className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold text-slate-900">{t('title')}</h3>
        {dirty && (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200 ring-inset">
            {t('unsaved')}
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          aria-pressed={asText}
          className={BUTTON}
          onClick={() => {
            setAsText((v) => !v);
          }}
        >
          {asText ? t('showPage') : t('editText')}
        </button>
      </div>
      <p className="text-xs text-slate-600">{t('intro')}</p>

      {parts.length > 1 && (
        <div
          role="tablist"
          aria-label={t('partsLabel')}
          className="flex gap-1 border-b border-slate-200"
        >
          {parts.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === shown}
              onClick={() => {
                setPart(p);
              }}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
                p === shown
                  ? 'border-brand-600 font-medium text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t(`parts.${p}`)}
            </button>
          ))}
        </div>
      )}

      {asText ? (
        <textarea
          value={draft[shown]}
          aria-label={t('textBox', { part: t(`parts.${shown}`) })}
          rows={16}
          onChange={(e) => {
            state.change(shown, e.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs"
        />
      ) : (
        <PageView
          key={shown}
          label={t(`parts.${shown}`)}
          text={draft[shown]}
          onChange={(text) => {
            state.change(shown, text);
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BUTTON} disabled={!state.canUndo} onClick={state.undo}>
          {t('undo')}
        </button>
        <button type="button" className={BUTTON} disabled={!dirty} onClick={state.reset}>
          {t('reset')}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => {
            save.mutate({ jobId, ...draft });
          }}
          className="h-9 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {save.isPending ? t('saving') : t('save')}
        </button>
      </div>
      {save.error && (
        <p role="alert" className="text-sm text-red-700">
          {t('saveError', { error: errorText(save.error) })}
        </p>
      )}
    </section>
  );
}
