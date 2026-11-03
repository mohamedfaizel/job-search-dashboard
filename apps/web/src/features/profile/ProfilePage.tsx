'use client';

import { useMe, useMyProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../i18n/useErrorText';
import { DocumentDesign } from './components/DocumentDesign';
import { GmailAccounts } from './components/GmailAccounts';
import { OtherResumes } from './components/OtherResumes';
import type { ProfileTab } from './components/ProfileForm';
import { ProfileForm } from './components/ProfileForm';
import { ResumeMatcherStatus } from './components/ResumeMatcherStatus';
import type { TabItem } from './components/TabList';
import { TabList } from './components/TabList';

const TAB_IDS: ProfileTab[] = ['personal', 'applications', 'resume', 'design', 'mail', 'matcher'];

const TAB_KEY = 'jobsearch.profile.tab';

/**
 * The tab you had open last time (only a convenience, so storage may be missing). On the
 * server there is no localStorage, but the tabs only show once the profile has loaded in the
 * browser, so the server and the browser never disagree about the tab.
 */
function savedTab(): ProfileTab {
  try {
    const tab = localStorage.getItem(TAB_KEY);
    return TAB_IDS.find((id) => id === tab) ?? 'personal';
  } catch {
    return 'personal';
  }
}

/** The My profile screen: your details, resumes, document design and Resume-Matcher. */
export function ProfilePage() {
  const errorText = useErrorText();
  const t = useTranslations('Profile');
  const tabs: TabItem<ProfileTab>[] = TAB_IDS.map((id) => ({ id, label: t(`tabs.${id}`) }));
  const { data: profile, isPending, error } = useMyProfile();
  const { data: me } = useMe();
  // Coming back from Google's sign-in (?gmail=...) opens the Email tab to show the result.
  const [tab, setTab] = useState<ProfileTab>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('gmail')
      ? 'mail'
      : savedTab(),
  );

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
        {t('title')}
      </h1>
      {isPending ? (
        <p className="text-sm text-slate-500">{t('loading')}</p>
      ) : error ? (
        <>
          <p role="alert" className="text-sm text-red-700">
            {t('loadFailed', { error: errorText(error) })}
          </p>
          <ResumeMatcherStatus />
        </>
      ) : (
        // The form starts from the saved profile, so it waits until that has loaded.
        <>
          <TabList
            label={t('sections')}
            idPrefix="profile-tab"
            panelId="profile-panel"
            tabs={tabs}
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
              {/* Only while open: it asks the server about Gmail, which other tabs don't need. */}
              {tab === 'mail' && <GmailAccounts />}
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
