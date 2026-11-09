'use client';

import { useJobResumeCopies } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useLanguageName } from '../../profile/components/useLanguageName';

/** The page address of a master resume (by language) or of one job's copy. */
export const masterHref = (language: string) => `/resume?language=${encodeURIComponent(language)}`;
export const jobHref = (jobId: string) => `/resume?job=${encodeURIComponent(jobId)}`;

/**
 * "English resume ▾": jump between your resumes (one per language) and your job copies.
 * Another language of your master resume switches in place; anything else opens its page.
 */
export function ResumeSwitcher({
  languages,
  language,
  job,
  onLanguage,
  onOpen,
}: {
  /** Your master resumes' languages. */
  languages: string[];
  language: string;
  /** The job copy on screen, if this is one. */
  job?: { jobId: string; title: string; company: string };
  onLanguage: (language: string) => void;
  onOpen: (href: string) => void;
}) {
  const t = useTranslations('Resume.switcher');
  const nameOf = useLanguageName();
  const copies = useJobResumeCopies().data ?? [];
  // The job on screen is listed even before it has a saved copy.
  const jobs = job && !copies.some((copy) => copy.jobId === job.jobId) ? [job, ...copies] : copies;
  const value = job ? `job:${job.jobId}` : `lang:${language}`;
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <span className="sr-only">{t('label')}</span>
      <select
        value={value}
        onChange={(event) => {
          const [kind, id = ''] = event.target.value.split(/:(.*)/s);
          if (kind === 'lang' && !job) onLanguage(id);
          else onOpen(kind === 'lang' ? masterHref(id) : jobHref(id));
        }}
        className="max-w-full min-w-0 truncate rounded-md border border-slate-300 bg-white py-1.5 pr-8 pl-2.5 text-base font-semibold text-slate-900"
      >
        <optgroup label={t('mine')}>
          {languages.map((code) => (
            <option key={code} value={`lang:${code}`}>
              {t('resumeIn', { language: nameOf(code) })}
            </option>
          ))}
        </optgroup>
        {jobs.length > 0 && (
          <optgroup label={t('copies')}>
            {jobs.map((copy) => (
              <option key={copy.jobId} value={`job:${copy.jobId}`}>
                {t('forJob', { title: copy.title, company: copy.company })}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
