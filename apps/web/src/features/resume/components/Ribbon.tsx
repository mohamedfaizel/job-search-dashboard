'use client';

import type { ReactNode } from 'react';

export interface RibbonTab<Id extends string> {
  id: Id;
  label: string;
}

/**
 * A toolbar like a word processor's: tabs along the top (Text, Design, Setup) and the tools of
 * the open tab under them. The caller renders every panel and hides the closed ones, so a change
 * waiting to be saved in one survives switching. `aside` sits on the right of the tab row.
 */
export function Ribbon<Id extends string>({
  label,
  tabs,
  current,
  onSelect,
  aside,
  sticky = false,
  children,
}: {
  label: string;
  tabs: RibbonTab<Id>[];
  current: Id;
  onSelect: (id: Id) => void;
  aside?: ReactNode;
  /** Keeps the ribbon on screen while you scroll (for the one-row Text tools). */
  sticky?: boolean;
  children: ReactNode;
}) {
  const go = (step: number) => {
    const index = tabs.findIndex((tab) => tab.id === current);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (!next) return;
    onSelect(next.id);
    document.getElementById(`ribbon-tab-${next.id}`)?.focus();
  };
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white shadow-sm ${
        sticky ? 'sticky top-2 z-20' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 border-b border-slate-200 px-2">
        <div role="tablist" aria-label={label} className="flex gap-1">
          {tabs.map((tab) => {
            const on = tab.id === current;
            return (
              <button
                key={tab.id}
                id={`ribbon-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="ribbon-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => {
                  onSelect(tab.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') go(1);
                  else if (event.key === 'ArrowLeft') go(-1);
                }}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  on
                    ? 'border-brand-600 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {aside && (
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-x-3 py-1.5 text-xs text-slate-600">
            {aside}
          </div>
        )}
      </div>
      <div
        role="tabpanel"
        id="ribbon-panel"
        aria-labelledby={`ribbon-tab-${current}`}
        className="p-2"
      >
        {children}
      </div>
    </div>
  );
}
