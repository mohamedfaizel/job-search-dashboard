'use client';

import dynamic from 'next/dynamic';

function Loading() {
  return <p className="text-sm text-slate-500">Loading…</p>;
}

// These screens remember choices in browser storage (hidden columns, jobs you went to apply
// on) and use the screen size, which the server can't know. So they skip the server render
// (ssr: false) and draw only in the browser: no flash of the wrong columns.
export const JobsScreen = dynamic(() => import('./JobsDashboard').then((m) => m.JobsDashboard), {
  ssr: false,
  loading: Loading,
});

export const TrackerScreen = dynamic(() => import('./Tracker').then((m) => m.TrackerPage), {
  ssr: false,
  loading: Loading,
});
