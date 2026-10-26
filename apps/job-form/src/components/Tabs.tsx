import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

export interface Tab<Id extends string> {
  id: Id;
  label: ReactNode;
  panel: ReactNode;
}

interface Props<Id extends string> {
  label: string;
  tabs: Tab<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
}

/**
 * Accessible tabs (WAI-ARIA tabs pattern): arrow keys, Home and End move between tabs.
 * Hidden panels stay mounted, so a half-filled form survives switching tabs.
 */
export function Tabs<Id extends string>({ label, tabs, selected, onSelect }: Props<Id>) {
  const baseId = useId();
  const buttons = useRef(new Map<Id, HTMLButtonElement>());

  // On narrow screens the tab strip scrolls sideways; keep the selected tab in sight.
  useEffect(() => {
    buttons.current.get(selected)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  function onKeyDown(event: KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.id === selected);
    const next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    const tab = next === undefined ? undefined : tabs[next];
    if (!tab) return;
    event.preventDefault();
    onSelect(tab.id);
    buttons.current.get(tab.id)?.focus();
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {tabs.map((tab) => {
          const active = tab.id === selected;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) buttons.current.set(tab.id, el);
                else buttons.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onKeyDown={onKeyDown}
              onClick={() => {
                onSelect(tab.id);
              }}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
                active
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== selected}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
