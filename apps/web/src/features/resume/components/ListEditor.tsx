import { useTranslations } from 'next-intl';
import type { DragEvent, KeyboardEvent } from 'react';
import { useEffect, useRef } from 'react';
import { insertAt, move, removeAt, replaceAt } from '../docOps';
import { KEYWORD_TYPE, withKeyword } from '../keywordDrag';
import { GripIcon, XIcon } from './icons';
import { DROP_LINE, FIELD, GRIP, ICON_BUTTON } from './ui';
import { useDragSort } from './useDragSort';

interface Props {
  /** Keeps drags inside this list, and names its fields for Undo. */
  scope: string;
  items: string[];
  onChange: (items: string[], field: string | null) => void;
  /** "Bullet", "Skill": read out with the item's number. */
  itemLabel: string;
  addLabel: string;
  placeholder?: string;
}

/**
 * A list of lines: bullets, skills. Enter adds a line below, Backspace on an empty line
 * removes it, Alt+↑/↓ moves a line; or drag it by its grip.
 */
export function ListEditor({ scope, items, onChange, itemLabel, addLabel, placeholder }: Props) {
  const t = useTranslations('Resume');
  const fields = useRef<(HTMLTextAreaElement | null)[]>([]);
  // The line to focus after the list changes (a new line, or the one above a removed line).
  const focusNext = useRef<number | null>(null);
  const drag = useDragSort(scope, (from, to) => {
    onChange(move(items, from, to), null);
  });

  useEffect(() => {
    if (focusNext.current === null) return;
    const field = fields.current[focusNext.current];
    focusNext.current = null;
    field?.focus();
  });

  // A keyword from the Job match tab can land on any line (the sort drag ignores it).
  const keywordDrop = (index: number) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (event.dataTransfer.types.includes(KEYWORD_TYPE)) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        drag.row(index).onDragOver(event);
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const term = event.dataTransfer.getData(KEYWORD_TYPE);
      if (term) {
        event.preventDefault();
        event.stopPropagation();
        onChange(replaceAt(items, index, withKeyword(items[index] ?? '', term)), null);
      } else {
        drag.row(index).onDrop(event);
      }
    },
  });

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      focusNext.current = index + 1;
      onChange(insertAt(items, index + 1, ''), null);
    } else if (event.key === 'Backspace' && items[index] === '' && items.length > 1) {
      event.preventDefault();
      focusNext.current = Math.max(0, index - 1);
      onChange(removeAt(items, index), null);
    } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const to = event.key === 'ArrowUp' ? index - 1 : index + 1;
      if (to < 0 || to >= items.length) return;
      focusNext.current = to;
      onChange(move(items, index, to), null);
    }
  };

  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li
            // Lines have no ids; the index is fine because every line is a controlled field.
            key={index}
            {...drag.row(index)}
            {...keywordDrop(index)}
            className={`flex items-start gap-1 rounded-md ${drag.over === index ? DROP_LINE : ''}`}
          >
            <span {...drag.grip(index)} className={GRIP} title={t('dragHint')} aria-hidden>
              <GripIcon />
            </span>
            <textarea
              ref={(el) => {
                fields.current[index] = el;
              }}
              rows={1}
              value={item}
              placeholder={placeholder}
              aria-label={`${itemLabel} ${String(index + 1)}`}
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              onChange={(event) => {
                onChange(replaceAt(items, index, event.target.value), `${scope}:${String(index)}`);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, index);
              }}
              className={`${FIELD} resize-none`}
            />
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={t('removeItem', { item: `${itemLabel} ${String(index + 1)}` })}
              title={t('remove')}
              onClick={() => {
                onChange(removeAt(items, index), null);
              }}
            >
              <XIcon />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="ml-6 text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
        onClick={() => {
          focusNext.current = items.length;
          onChange([...items, ''], null);
        }}
      >
        + {addLabel}
      </button>
    </div>
  );
}
