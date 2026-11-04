import {
  applySavedSettings,
  parseSavedSettings,
  toSavedSettings,
  useAppDispatch,
  useAppSelector,
  useSaveTableSettings,
  useTableSettings,
} from '@jobsearch/data';
import { useEffect, useRef } from 'react';
import { loadLocalColumnChoices } from './useColumnVisibility';

/** Wait this long after the last change before saving, so clicking around saves once. */
const SAVE_DELAY_MS = 800;

/**
 * Puts back the filters, sort and column choices you left Job posts with, and saves them again
 * whenever you change them, so the table opens your way on any device. `ready` turns true once
 * they are back (or there was nothing to put back, or loading them failed), so the table loads
 * only once instead of showing the defaults first.
 */
export function useSavedTableSettings(): boolean {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.jobsTable);
  const saved = useTableSettings();
  const { mutate } = useSaveTableSettings();
  // The text that is already saved, so nothing is sent until you change something.
  const lastSaved = useRef<string | null>(null);

  const loaded = saved.isSuccess || saved.isError;
  const ready = state.restored;
  useEffect(() => {
    if (!loaded || ready) return;
    const settings = parseSavedSettings(saved.data ?? null);
    // Nothing saved yet: keep the columns this browser remembered from before, so they aren't lost.
    dispatch(
      applySavedSettings(
        settings ?? parseSavedSettings(JSON.stringify({ columns: loadLocalColumnChoices() })),
      ),
    );
  }, [loaded, ready, saved.data, dispatch]);

  const text = toSavedSettings(state);
  useEffect(() => {
    if (!ready) return;
    // First pass after putting the settings back: this is what is saved already.
    lastSaved.current ??= text;
    if (text === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = text;
      mutate(text);
    }, SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [ready, text, mutate]);

  return ready;
}
