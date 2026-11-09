'use client';

import { useMyProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useLanguageName } from '../../profile/components/useLanguageName';

/**
 * Your setup at a glance, on the right of the toolbar: the file your resume comes from, its
 * language and the page limit every resume shares. The Setup tab changes them.
 */
export function SetupSummary() {
  const t = useTranslations('Resume.setup');
  const tProfile = useTranslations('Profile.resume');
  const languageName = useLanguageName();
  const { data: profile } = useMyProfile();
  if (!profile) return null;
  return (
    <>
      <span title={t('file')}>📄 {profile.resumeFileName ?? t('noFile')}</span>
      <span>{languageName(profile.resumeLanguage)}</span>
      <span>
        {t('allResumes', { pages: tProfile('pages', { count: profile.resumeMaxPages }) })}
      </span>
      {profile.keepMySections && <span>{t('keepHeadings')} ✓</span>}
    </>
  );
}
