'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { TabItem } from '../profile/components/TabList';
import { TabList } from '../profile/components/TabList';
import { ApiKeys } from './components/ApiKeys';
import { GmailAccounts } from './components/GmailAccounts';
import { NotificationSettings } from './components/NotificationSettings';

export type SettingsTab = 'keys' | 'gmail' | 'notifications';
const TAB_IDS: SettingsTab[] = ['keys', 'gmail', 'notifications'];

/**
 * Settings: how the app works for you (My profile is about you and your resume). Each setting
 * lives here only, nowhere else.
 */
export function SettingsPage() {
  const t = useTranslations('Settings');
  const tabs: TabItem<SettingsTab>[] = TAB_IDS.map((id) => ({ id, label: t(`tabs.${id}`) }));
  // Coming back from Google's sign-in (?gmail=...) opens Gmail to show the result; a link can
  // open any tab (?tab=notifications).
  const [tab, setTab] = useState<SettingsTab>(() => {
    if (typeof window === 'undefined') return 'keys';
    const params = new URLSearchParams(window.location.search);
    if (params.has('gmail')) return 'gmail';
    return TAB_IDS.find((id) => id === params.get('tab')) ?? 'keys';
  });

  return (
    <section aria-labelledby="settings-title" className="mx-auto max-w-3xl space-y-4">
      {/* Like My Jobs: the title and the tabs (as chips) share one line. */}
      <div className="flex items-center gap-3">
        <h1 id="settings-title" className="shrink-0 text-xl font-semibold text-slate-900">
          {t('title')}
        </h1>
        <TabList
          label={t('sections')}
          idPrefix="settings-tab"
          panelId="settings-panel"
          tabs={tabs}
          selected={tab}
          onSelect={setTab}
          variant="chips"
        />
      </div>
      <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'keys' && <ApiKeys />}
        {/* Only while open: it asks the server about Gmail, which other tabs don't need. */}
        {tab === 'gmail' && <GmailAccounts />}
        {tab === 'notifications' && <NotificationSettings />}
      </div>
    </section>
  );
}
