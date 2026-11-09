'use client';

import { useMyProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useLanguageName } from '../../profile/components/useLanguageName';
import { ResumeFiles } from './ResumeFiles';

/**
 * Setup, folded into one slim row above the steps: your file, its language, the page limit and
 * "keep my headings". ⚙ Change opens the full settings (upload, other languages) under it.
 */
export function SetupRow({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useTranslations('Resume.setup');
  const tProfile = useTranslations('Profile.resume');
  const languageName = useLanguageName();
  const { data: profile } = useMyProfile();
  return (
    <section aria-label={t('title')} className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-800 ring-1 ring-amber-200">
        <b className="font-semibold text-slate-900">{t('title')}</b>
        {profile && (
          <>
            <span title={t('file')}>📄 {profile.resumeFileName ?? t('noFile')}</span>
            <span>{languageName(profile.resumeLanguage)}</span>
            <span>{tProfile('pages', { count: profile.resumeMaxPages })}</span>
            {profile.keepMySections && <span>{t('keepHeadings')} ✓</span>}
          </>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="setup-details"
          onClick={onToggle}
          className="ml-auto rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {open ? t('close') : `⚙ ${t('change')}`}
        </button>
      </div>
      {open && (
        <div id="setup-details">
          <ResumeFiles />
        </div>
      )}
    </section>
  );
}
