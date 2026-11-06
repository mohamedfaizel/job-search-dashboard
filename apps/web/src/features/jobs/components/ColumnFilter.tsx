import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

/** One list of values in a filter that covers several things, like Seniority and Visa. */
export interface FilterGroup {
  name: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
}

interface Props {
  /** Column name, used in labels: "Filter Company". */
  column: string;
  options?: Option[];
  selected?: string[];
  onToggle?: (value: string) => void;
  /** Several titled lists in one panel, instead of `options`. */
  groups?: FilterGroup[];
  /** Clears every value, in all groups. */
  onClear: () => void;
  /** Shows a labelled chip (the quick filters above the table) instead of the funnel icon. */
  chip?: boolean;
}

/**
 * Funnel button in a column header that opens a checklist of values to filter by. With `chip`
 * the same checklist opens from a "Country ▾" chip above the table.
 */
export function ColumnFilter({
  column,
  options = [],
  selected = [],
  onToggle = () => undefined,
  groups,
  onClear,
  chip = false,
}: Props) {
  const t = useTranslations('Jobs.filter');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const lists: (Omit<FilterGroup, 'name'> & { name?: string })[] = groups ?? [
    { options, selected, onToggle },
  ];
  const optionCount = lists.reduce((n, list) => n + list.options.length, 0);
  const selectedCount = lists.reduce((n, list) => n + list.selected.length, 0);
  const matches = (o: Option) => o.label.toLowerCase().includes(query.toLowerCase());
  const active = selectedCount > 0;

  return (
    <div ref={rootRef} className="relative">
      {chip ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((o) => !o);
          }}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
            active
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          {column}
          {active && (
            <span className="rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
              {selectedCount}
            </span>
          )}
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 fill-current opacity-60">
            <path d="M4 6l4 4 4-4z" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          aria-label={
            active ? t('buttonActive', { column, count: selectedCount }) : t('button', { column })
          }
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((o) => !o);
          }}
          className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-xs hover:bg-slate-200 ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-400'}`}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
            <path d="M1.5 2h13l-5 6.2V13l-3 1.5V8.2z" />
          </svg>
          {active && <span>{selectedCount}</span>}
        </button>
      )}

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('button', { column })}
          className={`z-20 mt-1 rounded-lg ${
            // A chip near the right edge of a phone would push the panel off screen, so on
            // phones it spans the screen width just below the chip.
            chip
              ? 'fixed inset-x-4 sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:w-64'
              : 'absolute top-full left-0 w-64'
          } border border-slate-200 bg-white p-2 text-left font-normal shadow-lg`}
        >
          {optionCount > 8 && (
            <input
              type="search"
              aria-label={t('search', { column })}
              placeholder={t('placeholder')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              className="mb-2 w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          )}
          <div className="max-h-64 overflow-y-auto">
            {lists.map((list) => {
              const visible = list.options.filter(matches);
              return (
                <div key={list.name ?? ''}>
                  {list.name && (
                    <p className="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                      {list.name}
                    </p>
                  )}
                  <ul aria-label={list.name}>
                    {visible.length === 0 && (
                      <li className="px-2 py-1 text-sm text-slate-500">{t('none')}</li>
                    )}
                    {visible.map((option) => (
                      <li key={option.value}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={list.selected.includes(option.value)}
                            onChange={() => {
                              list.onToggle(option.value);
                            }}
                          />
                          <span className="truncate">{option.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {active && (
            <button
              type="button"
              onClick={onClear}
              className="mt-2 w-full rounded px-2 py-1 text-xs text-brand-700 hover:bg-brand-50"
            >
              {t('clear')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
