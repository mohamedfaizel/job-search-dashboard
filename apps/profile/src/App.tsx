import { DataProvider, getErrorMessage, useMyProfile } from '@jobsearch/data';
import { DocumentDesign } from './components/DocumentDesign';
import { OtherResumes } from './components/OtherResumes';
import { ProfileForm } from './components/ProfileForm';
import { ResumeMatcherStatus } from './components/ResumeMatcherStatus';

export default function App() {
  return (
    <DataProvider>
      <ProfilePage />
    </DataProvider>
  );
}

function ProfilePage() {
  const { data: profile, isPending, error } = useMyProfile();

  return (
    // One column on phones and tablets; two side by side on wide screens.
    <section aria-labelledby="profile-title" className="mx-auto max-w-screen-2xl space-y-6">
      <h1 id="profile-title" className="text-xl font-semibold text-slate-900">
        My profile
      </h1>
      {isPending ? (
        <p className="text-sm text-slate-500">Loading your profile…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-700">
          Could not load your profile: {getErrorMessage(error)}
        </p>
      ) : (
        // The form starts from the saved profile, so it waits until that has loaded.
        <>
          <ProfileForm profile={profile} />
          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <div className="space-y-6">
              <OtherResumes profile={profile} />
              <ResumeMatcherStatus />
            </div>
            <DocumentDesign />
          </div>
        </>
      )}
      {(isPending || error) && <ResumeMatcherStatus />}
    </section>
  );
}
