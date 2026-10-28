import { useEffect, useId, useRef, useState } from 'react';

export interface ColumnChoice {
  id: string;
  label: string;
  /** False for columns that must always show, like the job title. */
  canHide: boolean;
}

interface Props {
  columns: ColumnChoice[];
  /** { columnId: false } for each hidden column. */
  visibility: Record<string, boolean>;
  onToggle: (id: string) => void;
  onShowAll: () => void;
}

/** "Columns" button with a checklist to show or hide each table column. */
export function ColumnsMenu({ columns, visibility, onToggle, onShowAll }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const hiddenCount = columns.filter((c) => visibility[c.id] === false).length;

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current text-slate-500">
          <path d="M1 2h4v12H1zM6 2h4v12H6zM11 2h4v12h-4z" />
        </svg>
        Columns
        {hiddenCount > 0 && (
          <span className="rounded-full bg-indigo-100 px-1.5 text-xs text-indigo-700">
            {hiddenCount} hidden
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Show or hide columns"
          className="absolute top-full right-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          <ul className="max-h-80 overflow-y-auto">
            {columns.map((column) => (
              <li key={column.id}>
                <label
                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                    column.canHide
                      ? 'cursor-pointer text-slate-700 hover:bg-slate-50'
                      : 'text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visibility[column.id] !== false}
                    disabled={!column.canHide}
                    onChange={() => {
                      onToggle(column.id);
                    }}
                  />
                  {column.label}
                  {!column.canHide && <span className="text-xs">(always shown)</span>}
                </label>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={onShowAll}
              className="mt-2 w-full rounded px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
            >
              Show all columns
            </button>
          )}
        </div>
      )}
    </div>
  );
}
