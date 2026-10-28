import { useCallback, useMemo, useState } from 'react';

const STORAGE_KEY = 'jobsearch.dashboard.columns';
/** The first version saved only the ids you switched off. Still read, so nobody loses a choice. */
const OLD_STORAGE_KEY = 'jobsearch.dashboard.hiddenColumns';

type Choices = Record<string, boolean>;

/** Reads the saved choices. Storage can be blocked (private mode, settings), so never throw. */
function load(): Choices {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      return Object.fromEntries(
        Object.entries(saved).filter(
          (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
        ),
      );
    }
    const old: unknown = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(old)) return {};
    return Object.fromEntries(
      old.filter((id): id is string => typeof id === 'string').map((id) => [id, false]),
    );
  } catch {
    return {};
  }
}

function save(choices: Choices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch {
    // Not saved this time; the table still works for this visit.
  }
}

/**
 * Which table columns are switched on. `hiddenByDefault` columns start off; every checkbox you
 * tick or untick is saved as your own choice and wins over the default. A display preference for
 * this browser only, so it lives in localStorage rather than in the database or Redux.
 */
export function useColumnVisibility(hiddenByDefault: readonly string[] = []) {
  const [choices, setChoices] = useState(load);

  // TanStack Table's shape: { columnId: false } for each hidden column.
  const visibility = useMemo(
    () => ({ ...Object.fromEntries(hiddenByDefault.map((id) => [id, false])), ...choices }),
    [hiddenByDefault, choices],
  );

  const update = useCallback((next: Choices) => {
    setChoices(next);
    save(next);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      update({ ...choices, [id]: visibility[id] === false });
    },
    [choices, visibility, update],
  );
  const showAll = useCallback(() => {
    update(Object.fromEntries(Object.keys(visibility).map((id) => [id, true])));
  }, [visibility, update]);

  return { visibility, toggle, showAll };
}
