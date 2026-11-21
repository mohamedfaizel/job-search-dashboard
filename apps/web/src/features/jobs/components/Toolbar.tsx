import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { SearchBox } from './SearchBox';

interface Props {
  search: string;
  onSearch: (value: string) => void;
  activeFilterCount: number;
  onClearAll: () => void;
  /** The filters, shown in a sheet that the ⏷ button opens. */
  quickFilters?: ReactNode;
  /** Extra buttons after ⏷, like ↻ Recalculate Fit. */
  children?: ReactNode;
}

/**
 * The phone toolbar (the table header holds these on a computer): a full-width search box, one
 * ⏷ button that opens every filter in a sheet at the bottom, and the extra buttons.
 */
export function Toolbar({
  search,
  onSearch,
  activeFilterCount,
  onClearAll,
  quickFilters,
  children,
}: Props) {
  const t = useTranslations('Jobs.toolbar');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const sheetId = useId();
  const hasAnything = activeFilterCount > 0 || search !== '';

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="flex items-center gap-2">
      <SearchBox
        search={search}
        onSearch={onSearch}
        className="min-w-0 flex-1"
        inputClassName="h-11 text-base"
      />
      {quickFilters && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={sheetId}
          aria-label={
            activeFilterCount > 0
              ? `${t('filters')} (${t('active', { count: activeFilterCount })})`
              : t('filters')
          }
          onClick={() => {
            setOpen((o) => !o);
          }}
          className="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
            <path d="M1.5 2h13l-5 6.2V13l-3 1.5V8.2z" />
          </svg>
          {activeFilterCount > 0 && (
            <span
              aria-hidden="true"
              className="rounded-full bg-slate-900 px-1.5 text-xs text-white"
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      )}
      {children}
      {open && (
        <div
          id={sheetId}
          role="dialog"
          aria-label={t('filters')}
          className="fixed inset-x-0 bottom-[var(--tabbar)] z-40 max-h-[70vh] space-y-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{t('filters')}</p>
            <div className="flex items-center gap-3">
              {hasAnything && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-sm text-brand-700 hover:underline"
                >
                  {t('clearAll')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              >
                {t('done')}
              </button>
            </div>
          </div>
          {quickFilters}
        </div>
      )}
    </div>
  );
}
