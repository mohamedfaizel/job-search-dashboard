'use client';

import type { SavedSearch } from '@jobsearch/data';
import { getErrorMessage, useMe, useSavedSearches } from '@jobsearch/data';
import { useState } from 'react';
import { AddJobForm } from './components/AddJobForm';
import { ImportHistory } from './components/ImportHistory';
import { SavedSearches } from './components/SavedSearches';
import { SyncPanel } from './components/SyncPanel';
import { Tabs } from './components/Tabs';

type TabId = 'saved' | 'import' | 'manual';

/** Add jobs: saved searches, imports from JobsPipe and adding a job by hand. */
export function AddJobsPage() {
  const { data: me, isPending, error } = useMe();
  if (isPending) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {getErrorMessage(error)}
      </p>
    );
  }
  // Imports spend the server's JobsPipe credits, so only the admin may add jobs. The API checks
  // this too; here we just say so instead of showing forms that would fail.
  if (me?.role !== 'ADMIN') {
    return (
      <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold">Add jobs</h1>
        <p className="mt-2 text-sm text-slate-600">Only the admin can add or import jobs.</p>
      </section>
    );
  }
  return <AddJobs />;
}

function AddJobs() {
  const [tab, setTab] = useState<TabId>('saved');
  // "Edit" on a saved search puts it into the import form. The key remounts the form with it.
  const [loaded, setLoaded] = useState<SavedSearch | null>(null);
  const [formKey, setFormKey] = useState(0);
  const { data: searches } = useSavedSearches();

  return (
    <section aria-labelledby="add-jobs-title" className="space-y-6">
      <h1 id="add-jobs-title" className="text-xl font-semibold text-slate-900">
        Add jobs
      </h1>
      <Tabs
        label="Ways to add jobs"
        selected={tab}
        onSelect={setTab}
        tabs={[
          {
            id: 'saved',
            label: searches ? `Saved searches (${searches.length})` : 'Saved searches',
            short: searches ? `Saved (${searches.length})` : 'Saved',
            panel: (
              <SavedSearches
                onLoad={(search) => {
                  setLoaded(search);
                  setFormKey((k) => k + 1);
                  setTab('import');
                }}
              />
            ),
          },
          {
            id: 'import',
            label: 'Import from JobsPipe',
            short: 'Import',
            panel: (
              <div>
                <SyncPanel key={formKey} loaded={loaded} />
              </div>
            ),
          },
          {
            id: 'manual',
            label: 'Add a job by hand',
            short: 'By hand',
            panel: (
              <div>
                <AddJobForm />
              </div>
            ),
          },
        ]}
      />
      {/* Outside the tabs, so every tab shows what the imports brought in. */}
      <div className="border-t border-slate-200 pt-6">
        <ImportHistory />
      </div>
    </section>
  );
}
