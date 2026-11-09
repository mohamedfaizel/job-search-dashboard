import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { Edit } from '../formatText';
import { addLink, clearMarks, toggleMark } from '../formatText';
import { EraserIcon, LinkIcon } from './icons';

type Field = HTMLTextAreaElement | HTMLInputElement;

const BUTTON =
  'inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-brand-500';

const isField = (el: EventTarget | null): el is Field =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && el.type === 'text' && el.inputMode !== 'url');

/** Puts new text in a field the way typing does, so React's onChange (and Undo) see it. */
function write(field: Field, edit: Edit) {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(field, edit.value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.focus();
  field.setSelectionRange(edit.start, edit.end);
}

/**
 * Bold, italic, link and clear for the text field you last clicked in, inside `scope`. The
 * text stays plain Markdown, so the PDF, Fit % and the prompts read it as before. Ctrl+B and
 * Ctrl+I work in the same fields.
 */
export function FormatBar({
  scope,
  bare = false,
}: {
  scope: React.RefObject<HTMLElement | null>;
  /** Inside a toolbar that has its own box (and stays on screen). */
  bare?: boolean;
}) {
  const t = useTranslations('Resume.format');
  const target = useRef<Field | null>(null);
  const picked = useRef({ start: 0, end: 0 });
  const [active, setActive] = useState(false);
  const [asking, setAsking] = useState(false);
  const [url, setUrl] = useState('');

  const apply = (change: (field: { value: string; start: number; end: number }) => Edit) => {
    const field = target.current;
    if (!field) return;
    write(
      field,
      change({
        value: field.value,
        start: field.selectionStart ?? 0,
        end: field.selectionEnd ?? 0,
      }),
    );
  };

  useEffect(() => {
    const inScope = (el: EventTarget | null): el is Field =>
      isField(el) && !!scope.current?.contains(el) && !el.dataset['plain'];
    const focus = (event: FocusEvent) => {
      if (inScope(event.target)) {
        target.current = event.target;
        setActive(true);
        setAsking(false);
      }
    };
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !inScope(event.target)) return;
      const mark =
        event.key.toLowerCase() === 'b' ? '**' : event.key.toLowerCase() === 'i' ? '*' : null;
      if (!mark) return;
      event.preventDefault();
      target.current = event.target;
      apply((f) => toggleMark(f, mark));
    };
    document.addEventListener('focusin', focus);
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('focusin', focus);
      document.removeEventListener('keydown', keys);
    };
  });

  // Keeps the text selected: a button must not take the focus from the field.
  const keep = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const link = () => {
    const field = target.current;
    if (!field) return;
    picked.current = { start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0 };
    setAsking(true);
  };

  const confirmLink = () => {
    const address = url.trim();
    setAsking(false);
    setUrl('');
    if (!address) return;
    const { start, end } = picked.current;
    apply((f) => addLink({ ...f, start, end }, address));
  };

  return (
    <div
      role="toolbar"
      aria-label={t('label')}
      className={`flex flex-wrap items-center gap-0.5 ${
        bare
          ? ''
          : 'sticky top-2 z-10 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-sm'
      }`}
    >
      <button
        type="button"
        className={`${BUTTON} font-bold`}
        disabled={!active}
        aria-label={t('bold')}
        title={`${t('bold')} (Ctrl+B)`}
        onMouseDown={keep}
        onClick={() => {
          apply((f) => toggleMark(f, '**'));
        }}
      >
        B
      </button>
      <button
        type="button"
        className={`${BUTTON} italic`}
        disabled={!active}
        aria-label={t('italic')}
        title={`${t('italic')} (Ctrl+I)`}
        onMouseDown={keep}
        onClick={() => {
          apply((f) => toggleMark(f, '*'));
        }}
      >
        I
      </button>
      <button
        type="button"
        className={BUTTON}
        disabled={!active}
        aria-label={t('link')}
        title={t('link')}
        onMouseDown={keep}
        onClick={link}
      >
        <LinkIcon />
      </button>
      <button
        type="button"
        className={BUTTON}
        disabled={!active}
        aria-label={t('clear')}
        title={t('clear')}
        onMouseDown={keep}
        onClick={() => {
          apply(clearMarks);
        }}
      >
        <EraserIcon />
      </button>
      {asking && (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            confirmLink();
          }}
        >
          <input
            ref={(el) => {
              el?.focus();
            }}
            type="text"
            inputMode="url"
            value={url}
            aria-label={t('address')}
            placeholder="https://"
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            className="w-44 rounded-md border border-slate-300 px-2 py-0.5 text-xs"
          />
          <button type="submit" className={`${BUTTON} text-emerald-700`} aria-label={t('addLink')}>
            ✓
          </button>
          <button
            type="button"
            className={`${BUTTON} text-red-700`}
            aria-label={t('cancel')}
            onClick={() => {
              setAsking(false);
            }}
          >
            ✕
          </button>
        </form>
      )}
      <span className="ml-1 hidden text-xs text-slate-500 sm:inline">
        {active ? t('hint') : t('hintIdle')}
      </span>
    </div>
  );
}
