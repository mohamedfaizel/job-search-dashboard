import { DataProvider } from '@jobsearch/data';
import { JobsDashboard } from './JobsDashboard';

export default function App() {
  return (
    <DataProvider>
      <JobsDashboard />
    </DataProvider>
  );
}
