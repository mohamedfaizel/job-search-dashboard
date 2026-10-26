import type { SavedSearch } from '@jobsearch/data';
import { DataProvider } from '@jobsearch/data';
import { useState } from 'react';
import { AddJobForm } from './components/AddJobForm';
import { ImportHistory } from './components/ImportHistory';
import { SavedSearches } from './components/SavedSearches';
import { SyncPanel } from './components/SyncPanel';

export default function App() {
  // "Edit" on a saved search puts it into the import form. The key remounts the form with it.
  const [loaded, setLoaded] = useState<SavedSearch | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <DataProvider>
      <section aria-labelledby="add-jobs-title" className="space-y-8">
        <h1 id="add-jobs-title" className="text-xl font-semibold text-slate-900">
          Add jobs
        </h1>
        <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
          <AddJobForm />
          <SyncPanel key={formKey} loaded={loaded} />
        </div>
        <SavedSearches
          onLoad={(search) => {
            setLoaded(search);
            setFormKey((k) => k + 1);
            document.getElementById('sync-heading')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <ImportHistory />
      </section>
    </DataProvider>
  );
}
