import { useCallback, useState } from 'react';

const STORAGE_KEY = 'jobsearch.dashboard.hiddenColumns';

/** Reads the saved choice. Storage can be blocked (private mode, settings), so never throw. */
function load(): Record<string, boolean> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(saved)) return {};
    return Object.fromEntries(
      saved.filter((id): id is string => typeof id === 'string').map((id) => [id, false]),
    );
  } catch {
    return {};
  }
}

function save(visibility: Record<string, boolean>) {
  try {
    const hidden = Object.keys(visibility).filter((id) => visibility[id] === false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
  } catch {
    // Not saved this time; the table still works for this visit.
  }
}

/**
 * Which table columns you switched off. A display preference for this browser only, so it lives
 * in localStorage rather than in the database or Redux.
 */
export function useColumnVisibility() {
  const [visibility, setVisibility] = useState(load);

  const update = useCallback((next: Record<string, boolean>) => {
    setVisibility(next);
    save(next);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      const { [id]: current, ...rest } = visibility;
      update(current === false ? rest : { ...rest, [id]: false });
    },
    [visibility, update],
  );
  const showAll = useCallback(() => {
    update({});
  }, [update]);

  return { visibility, toggle, showAll };
}
