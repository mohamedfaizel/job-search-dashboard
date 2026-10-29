import type { SavedSearch } from '@jobsearch/data';
import { DataProvider, useSavedSearches } from '@jobsearch/data';
import { useState } from 'react';
import { AddJobForm } from './components/AddJobForm';
import { ImportHistory } from './components/ImportHistory';
import { SavedSearches } from './components/SavedSearches';
import { SyncPanel } from './components/SyncPanel';
import { Tabs } from './components/Tabs';

type TabId = 'saved' | 'import' | 'manual';

export default function App() {
  return (
    <DataProvider>
      <AddJobs />
    </DataProvider>
  );
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
              <div className="max-w-2xl">
                <SyncPanel key={formKey} loaded={loaded} />
              </div>
            ),
          },
          {
            id: 'manual',
            label: 'Add a job by hand',
            short: 'By hand',
            panel: (
              <div className="max-w-3xl">
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
