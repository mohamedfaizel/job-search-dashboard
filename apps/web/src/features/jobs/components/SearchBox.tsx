import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface Props {
  search: string;
  onSearch: (value: string) => void;
  /** Classes for the box around the input (its width). */
  className?: string;
  /** Classes for the input itself (height, text size). */
  inputClassName?: string;
}

/**
 * The "Job title or company" search box. It waits 300 ms after you stop typing, so we don't
 * query on every keystroke. It sits in the Job column's header (desktop) or above the cards.
 */
export function SearchBox({
  search,
  onSearch,
  className = '',
  inputClassName = 'py-1.5 text-sm',
}: Props) {
  const t = useTranslations('Jobs.toolbar');
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

  return (
    <div className={`relative ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 fill-current text-slate-400"
      >
        <path d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      </svg>
      <input
        type="search"
        aria-label={t('search')}
        placeholder={t('placeholder')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        className={`w-full rounded-lg border border-slate-300 bg-white pr-3 pl-8 font-normal text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none ${inputClassName}`}
      />
    </div>
  );
}
