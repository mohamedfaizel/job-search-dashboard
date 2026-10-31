import { DataProvider, getErrorMessage, useMe, useMyProfile } from '@jobsearch/data';
import { useState } from 'react';
import { DocumentDesign } from './components/DocumentDesign';
import { OtherResumes } from './components/OtherResumes';
import type { ProfileTab } from './components/ProfileForm';
import { ProfileForm } from './components/ProfileForm';
import { ResumeMatcherStatus } from './components/ResumeMatcherStatus';
import type { TabItem } from './components/TabList';
import { TabList } from './components/TabList';

export default function App() {
  return (
    <DataProvider>
      <ProfilePage />
    </DataProvider>
  );
}

const TABS: TabItem<ProfileTab>[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'applications', label: 'Applications' },
  { id: 'resume', label: 'Resume' },
  { id: 'design', label: 'Design' },
  { id: 'matcher', label: 'Resume-Matcher' },
];

const TAB_KEY = 'jobsearch.profile.tab';

/** The tab you had open last time (only a convenience, so storage may be missing). */
function savedTab(): ProfileTab {
  try {
    const tab = localStorage.getItem(TAB_KEY);
    return TABS.find((t) => t.id === tab)?.id ?? 'personal';
  } catch {
    return 'personal';
  }
}

function ProfilePage() {
  const { data: profile, isPending, error } = useMyProfile();
  const { data: me } = useMe();
  const [tab, setTab] = useState<ProfileTab>(savedTab);

  const selectTab = (next: ProfileTab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Private windows can block storage; the tab just won't be remembered.
    }
  };

  return (
    <section aria-labelledby="profile-title" className="mx-auto max-w-screen-2xl space-y-6">
      <h1 id="profile-title" className="text-xl font-semibold text-slate-900">
        My profile
      </h1>
      {isPending ? (
        <p className="text-sm text-slate-500">Loading your profile…</p>
      ) : error ? (
        <>
          <p role="alert" className="text-sm text-red-700">
            Could not load your profile: {getErrorMessage(error)}
          </p>
          <ResumeMatcherStatus />
        </>
      ) : (
        // The form starts from the saved profile, so it waits until that has loaded.
        <>
          <TabList
            label="Profile sections"
            idPrefix="profile-tab"
            panelId="profile-panel"
            tabs={TABS}
            selected={tab}
            onSelect={selectTab}
          />
          {/* One panel; every tab's content stays mounted and only the selected one shows. */}
          <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${tab}`}>
            {/* gap, unlike space-y, ignores the hidden sections. */}
            <div className="flex flex-col gap-6">
              <ProfileForm
                profile={profile}
                accountName={me?.name ?? ''}
                tab={tab}
                onTab={selectTab}
              />
              <div hidden={tab !== 'resume'}>
                <OtherResumes profile={profile} />
              </div>
              <div hidden={tab !== 'design'}>
                <DocumentDesign />
              </div>
              <div hidden={tab !== 'matcher'}>
                <ResumeMatcherStatus />
              </div>
            </div>
          </div>
        </>
      )}
      {isPending && <ResumeMatcherStatus />}
    </section>
  );
}
