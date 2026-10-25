import { lazy, useState } from 'react';
import { Layout, type View } from './components/Layout';
import { RemoteBoundary } from './components/RemoteBoundary';

// Each import below is fetched from another app's server at runtime (Module Federation).
const DashboardApp = lazy(() => import('dashboard/App'));
const JobFormApp = lazy(() => import('jobForm/App'));

export default function App() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <Layout current={view} onNavigate={setView}>
      {view === 'dashboard' ? (
        <RemoteBoundary key="dashboard" name="dashboard">
          <DashboardApp />
        </RemoteBoundary>
      ) : (
        <RemoteBoundary key="job-form" name="job form">
          <JobFormApp />
        </RemoteBoundary>
      )}
    </Layout>
  );
}
