import type { KeyboardEvent } from 'react';
import { useEffect, useRef } from 'react';

export interface TabItem<Id extends string> {
  id: Id;
  label: string;
}

interface Props<Id extends string> {
  label: string;
  /** Prefix for the tab ids, so the panel can name the selected tab. */
  idPrefix: string;
  /** The id of the one panel that shows the selected tab's content. */
  panelId: string;
  tabs: TabItem<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
}

/**
 * The tab strip (WAI-ARIA tabs pattern): arrow keys, Home and End move between tabs.
 * The page keeps every tab's content mounted and hides the others, so unsaved edits
 * survive switching tabs.
 */
export function TabList<Id extends string>({
  label,
  idPrefix,
  panelId,
  tabs,
  selected,
  onSelect,
}: Props<Id>) {
  const buttons = useRef(new Map<Id, HTMLButtonElement>());

  // On phones the strip scrolls sideways; keep the selected tab in sight.
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
            id={`${idPrefix}-${tab.id}`}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => {
              onSelect(tab.id);
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap sm:px-4 ${
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
  );
}
