import { setColumnChoices, useAppDispatch, useAppSelector } from '@jobsearch/data';
import { useCallback, useMemo } from 'react';

const STORAGE_KEY = 'jobsearch.dashboard.columns';
/** The first version saved only the ids you switched off. Still read, so nobody loses a choice. */
const OLD_STORAGE_KEY = 'jobsearch.dashboard.hiddenColumns';

type Choices = Record<string, boolean>;

/**
 * The choices an earlier version kept in this browser. Read once, when nothing is saved on the
 * server yet, so nobody loses their columns. Storage can be blocked (private mode, settings), so never throw. */
export function loadLocalColumnChoices(): Choices {
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

/**
 * Which table columns are switched on. `hiddenByDefault` columns start off; every checkbox you
 * tick or untick is your own choice and wins over the default. The choices are kept with the
 * rest of your saved Job posts settings (see useSavedTableSettings), so they follow you to other
 * devices.
 */
export function useColumnVisibility(hiddenByDefault: readonly string[] = []) {
  const dispatch = useAppDispatch();
  const choices = useAppSelector((state) => state.jobsTable.columns);

  // TanStack Table's shape: { columnId: false } for each hidden column.
  const visibility = useMemo(
    () => ({ ...Object.fromEntries(hiddenByDefault.map((id) => [id, false])), ...choices }),
    [hiddenByDefault, choices],
  );

  const update = useCallback(
    (next: Choices) => {
      dispatch(setColumnChoices(next));
    },
    [dispatch],
  );

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
