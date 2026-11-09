'use client';

import { useMe, useMyProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useErrorText } from '../../i18n/useErrorText';
import { AchievementsTab } from '../resume/components/AchievementsTab';
import type { ProfileTab } from './components/ProfileForm';
import { ProfileForm } from './components/ProfileForm';
import { StoryBank } from './components/StoryBank';
import type { TabItem } from './components/TabList';
import { TabList } from './components/TabList';

const TAB_IDS: ProfileTab[] = ['personal', 'applications', 'achievements', 'stories'];

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

/** The My profile screen: your details, application answers and resumes. */
export function ProfilePage() {
  const errorText = useErrorText();
  const t = useTranslations('Profile');
  const tabs: TabItem<ProfileTab>[] = TAB_IDS.map((id) => ({ id, label: t(`tabs.${id}`) }));
  const { data: profile, isPending, error } = useMyProfile();
  const { data: me } = useMe();
  // A link can open a tab (?tab=resume).
  const [tab, setTab] = useState<ProfileTab>(() => {
    if (typeof window === 'undefined') return savedTab();
    const params = new URLSearchParams(window.location.search);
    return TAB_IDS.find((id) => id === params.get('tab')) ?? savedTab();
  });
  // Email and Resume-Matcher moved to Settings, Design and Resume to the Resume page: an old
  // link (?tab=mail, ?gmail=..., ?tab=matcher, ?tab=design, ?tab=resume) goes there.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'mail' || params.has('gmail')) {
      const gmail = params.get('gmail');
      window.location.replace(
        `/settings?tab=gmail${gmail ? `&gmail=${encodeURIComponent(gmail)}` : ''}`,
      );
    } else if (params.get('tab') === 'matcher') {
      window.location.replace('/settings?tab=keys');
    } else if (params.get('tab') === 'design') {
      window.location.replace('/resume?tab=look');
    } else if (params.get('tab') === 'resume') {
      window.location.replace('/resume?tab=files');
    }
  }, []);

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
              {/* Facts about you, with numbers: Job match offers them as resume bullets. */}
              {tab === 'achievements' && <AchievementsTab />}
              {/* True STAR stories: interview prep picks the ones that fit each job. */}
              {tab === 'stories' && <StoryBank />}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
