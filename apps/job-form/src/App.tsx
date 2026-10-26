import { DataProvider } from '@jobsearch/data';
import { AddJobForm } from './components/AddJobForm';
import { SyncPanel } from './components/SyncPanel';

export default function App() {
  return (
    <DataProvider>
      <section aria-labelledby="add-jobs-title" className="space-y-4">
        <h1 id="add-jobs-title" className="text-xl font-semibold text-slate-900">
          Add jobs
        </h1>
        <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
          <AddJobForm />
          <SyncPanel />
        </div>
      </section>
    </DataProvider>
  );
}
