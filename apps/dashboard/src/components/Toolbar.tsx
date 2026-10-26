import { useEffect, useState } from 'react';

interface Props {
  search: string;
  onSearch: (value: string) => void;
  activeFilterCount: number;
  onClearAll: () => void;
}

/** Search box (debounced so we don't query on every keystroke) and a "clear filters" button. */
export function Toolbar({ search, onSearch, activeFilterCount, onClearAll }: Props) {
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
      <input
        type="search"
        aria-label="Search jobs"
        placeholder="Search title or company…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        className="w-72 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
      />
      {activeFilterCount > 0 && (
        <span className="text-sm text-slate-600">
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
    </div>
  );
}
