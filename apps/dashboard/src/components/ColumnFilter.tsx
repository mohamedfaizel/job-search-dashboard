import { useEffect, useId, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  /** Column name, used in labels: "Filter Company". */
  column: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}

/** Funnel button in a column header that opens a checklist of values to filter by. */
export function ColumnFilter({ column, options, selected, onToggle, onClear }: Props) {
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

  const visible = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const active = selected.length > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Filter ${column}${active ? ` (${selected.length} selected)` : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-xs hover:bg-slate-200 ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
          <path d="M1.5 2h13l-5 6.2V13l-3 1.5V8.2z" />
        </svg>
        {active && <span>{selected.length}</span>}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Filter ${column}`}
          className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 text-left font-normal shadow-lg"
        >
          {options.length > 8 && (
            <input
              type="search"
              aria-label={`Search ${column} values`}
              placeholder="Search…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              className="mb-2 w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          )}
          <ul className="max-h-64 overflow-y-auto">
            {visible.length === 0 && (
              <li className="px-2 py-1 text-sm text-slate-500">No values</li>
            )}
            {visible.map((option) => (
              <li key={option.value}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => {
                      onToggle(option.value);
                    }}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              </li>
            ))}
          </ul>
          {active && (
            <button
              type="button"
              onClick={onClear}
              className="mt-2 w-full rounded px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
