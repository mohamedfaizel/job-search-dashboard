'use client';

import type { SavedSearch } from '@jobsearch/data';
import { useMe, useSavedSearches } from '@jobsearch/data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../i18n/useErrorText';
import { AddJobForm } from './components/AddJobForm';
import { ImportHistory } from './components/ImportHistory';
import { SavedSearches } from './components/SavedSearches';
import { SyncPanel } from './components/SyncPanel';
import { Tabs } from './components/Tabs';

type TabId = 'saved' | 'import' | 'manual';

/**
 * Add jobs: saved searches, imports from JobHunter and adding a job by hand. Anyone can add jobs;
 * JobHunter imports use the token in your own Settings.
 */
export function AddJobsPage() {
  const errorText = useErrorText();
  const { isPending, error } = useMe();
  const t = useTranslations('AddJobs');
  if (isPending) return <p className="text-sm text-slate-500">{t('loading')}</p>;
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(error)}
      </p>
    );
  }
  return <AddJobs />;
}

function AddJobs() {
  const t = useTranslations('AddJobs');
  const [tab, setTab] = useState<TabId>('saved');
  // "Edit" on a saved search puts it into the import form. The key remounts the form with it.
  const [loaded, setLoaded] = useState<SavedSearch | null>(null);
  const [formKey, setFormKey] = useState(0);
  const { data: searches } = useSavedSearches();

  return (
    <section aria-labelledby="add-jobs-title" className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 id="add-jobs-title" className="text-xl font-semibold text-slate-900">
          {t('title')}
        </h1>
        <p className="text-xs text-slate-600">
          {t('tokenHint')}{' '}
          <Link href="/settings" className="text-brand-700 underline">
            {t('openSettings')}
          </Link>
        </p>
      </div>
      <Tabs
        label={t('tabsLabel')}
        selected={tab}
        onSelect={setTab}
        tabs={[
          {
            id: 'saved',
            label: searches ? t('tabs.savedCount', { count: searches.length }) : t('tabs.saved'),
            short: searches
              ? t('tabs.savedShortCount', { count: searches.length })
              : t('tabs.savedShort'),
            panel: (
              <SavedSearches
                onLoad={(search) => {
                  setLoaded(search);
                  setFormKey((k) => k + 1);
                  setTab('import');
                }}
              />
            ),
          },
          {
            id: 'import',
            label: t('tabs.import'),
            short: t('tabs.importShort'),
            panel: (
              <div>
                <SyncPanel key={formKey} loaded={loaded} />
              </div>
            ),
          },
          {
            id: 'manual',
            label: t('tabs.manual'),
            short: t('tabs.manualShort'),
            panel: (
              <div>
                <AddJobForm />
              </div>
            ),
          },
        ]}
      />
      {/* Outside the tabs, so every tab shows what the imports brought in. */}
      <div className="pt-2">
        <ImportHistory />
      </div>
    </section>
  );
}
