import { DataProvider, getErrorMessage, useLogOut, useMe } from '@jobsearch/data';
import { lazy, useState } from 'react';
import { AuthPage } from './components/AuthPage';
import { Layout, type View } from './components/Layout';
import { RemoteBoundary } from './components/RemoteBoundary';

// Each import below is fetched from another app's server at runtime (Module Federation).
const DashboardApp = lazy(() => import('dashboard/App'));
const JobFormApp = lazy(() => import('jobForm/App'));
const ProfileApp = lazy(() => import('profile/App'));

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

/** Asks the API who is logged in, then shows the login page or the app. */
export function Shell() {
  const { data: user, isPending, error } = useMe();
  const logOut = useLogOut();
  const [view, setView] = useState<View>('dashboard');

  if (isPending) {
    return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  }
  if (error) {
    return (
      <p role="alert" className="p-6 text-sm text-red-700">
        {getErrorMessage(error)}
      </p>
    );
  }
  if (!user) return <AuthPage />;

  // A regular user can't open the admin-only page, even if it was open for someone else.
  const current = view === 'add-job' && user.role !== 'ADMIN' ? 'dashboard' : view;

  return (
    <Layout
      user={user}
      current={current}
      onNavigate={setView}
      onLogOut={() => {
        setView('dashboard');
        logOut.mutate();
      }}
    >
      {current === 'dashboard' && (
        <RemoteBoundary key="dashboard" name="dashboard">
          <DashboardApp />
        </RemoteBoundary>
      )}
      {current === 'add-job' && (
        <RemoteBoundary key="job-form" name="job form">
          <JobFormApp />
        </RemoteBoundary>
      )}
      {current === 'profile' && (
        <RemoteBoundary key="profile" name="profile">
          <ProfileApp />
        </RemoteBoundary>
      )}
    </Layout>
  );
}
