import type { Job } from '@jobsearch/data';
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'jobsearch.dashboard.applying';
/** After a week, an unanswered "Did you apply?" is dropped. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** A posting you opened from the Apply kit, waiting for "Did you apply?". */
export interface PendingApply {
  id: string;
  title: string;
  company: string;
  openedAt: number;
}

function load(): PendingApply[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    return (saved as PendingApply[]).filter(
      (p) => typeof p.id === 'string' && Date.now() - p.openedAt < MAX_AGE_MS,
    );
  } catch {
    return [];
  }
}

function save(pending: PendingApply[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Not saved this time: the question still shows until you reload.
  }
}

/**
 * The postings you went to apply on. Kept in this browser (localStorage), so the question is
 * still there when you come back from the job site, even after closing the tab.
 */
export function usePendingApplies() {
  const [pending, setPending] = useState(load);

  const update = useCallback((next: PendingApply[]) => {
    setPending(next);
    save(next);
  }, []);

  const start = useCallback(
    (job: Job) => {
      const rest = pending.filter((p) => p.id !== job.id);
      update([
        ...rest,
        { id: job.id, title: job.title, company: job.company.name, openedAt: Date.now() },
      ]);
    },
    [pending, update],
  );
  const answer = useCallback(
    (id: string) => {
      update(pending.filter((p) => p.id !== id));
    },
    [pending, update],
  );

  return { pending, start, answer };
}
