import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

interface Props {
  search: string;
  onSearch: (value: string) => void;
  activeFilterCount: number;
  onClearAll: () => void;
  /** Extra controls on the right, like the Columns menu. */
  children?: ReactNode;
}

/** Search box (debounced so we don't query on every keystroke) and a "clear filters" button. */
export function Toolbar({ search, onSearch, activeFilterCount, onClearAll, children }: Props) {
  const [value, setValue] = useState(search);

  // Keep the box in sync when the search is cleared from elsewhere (e.g. "Clear all").
  // Adjusting state while rendering is React's recommended alternative to an effect here.
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    setValue(search);
  }

  useEffect(() => {
    if (value === search) return;
    const timer = setTimeout(() => {
      onSearch(value);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [value, search, onSearch]);

  const hasAnything = activeFilterCount > 0 || search !== '';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 fill-current text-slate-400"
        >
          <path d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
        <input
          type="search"
          aria-label="Search jobs"
          placeholder="Search title or company…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          className="w-72 rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-8 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>
      {activeFilterCount > 0 && (
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active
        </span>
      )}
      {hasAnything && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm text-indigo-700 hover:underline"
        >
          Clear all
        </button>
      )}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
