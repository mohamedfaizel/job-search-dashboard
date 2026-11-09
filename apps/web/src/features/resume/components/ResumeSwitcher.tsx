'use client';

import { useTranslations } from 'next-intl';
import { useLanguageName } from '../../profile/components/useLanguageName';

/** The page address of a master resume (by language) or of one job's copy. */
export const masterHref = (language: string) => `/resume?language=${encodeURIComponent(language)}`;
export const jobHref = (jobId: string) => `/resume?job=${encodeURIComponent(jobId)}`;
export const letterHref = (language: string) => `/resume?letter=${encodeURIComponent(language)}`;

/**
 * "English resume ▾": jump between your resumes and your cover letter templates (one of each
 * per language). Another language of your master resume switches in place; anything else opens
 * its page. A job's copy is listed only while you are on it (open job copies from the job).
 */
export function ResumeSwitcher({
  languages,
  language,
  job,
  letter = false,
  onLanguage,
  onOpen,
}: {
  /** Your master resumes' languages. */
  languages: string[];
  language: string;
  /** The job copy on screen, if this is one. */
  job?: { jobId: string; title: string; company: string };
  /** True on a cover letter template page. */
  letter?: boolean;
  onLanguage: (language: string) => void;
  onOpen: (href: string) => void;
}) {
  const t = useTranslations('Resume.switcher');
  const nameOf = useLanguageName();
  const value = job ? `job:${job.jobId}` : `${letter ? 'letter' : 'lang'}:${language}`;
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      {/* On your own resume the list picks its language; elsewhere it is a plain switcher. */}
      <span className={job || letter ? 'sr-only' : 'shrink-0 text-xs font-medium text-slate-500'}>
        {job || letter ? t('label') : t('languageLabel')}
      </span>
      <select
        value={value}
        onChange={(event) => {
          const [kind, id = ''] = event.target.value.split(/:(.*)/s);
          if (kind === 'lang' && !job && !letter) onLanguage(id);
          else onOpen(kind === 'lang' ? masterHref(id) : letterHref(id));
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
        <optgroup label={t('letters')}>
          {languages.map((code) => (
            <option key={code} value={`letter:${code}`}>
              {t('letterIn', { language: nameOf(code) })}
            </option>
          ))}
        </optgroup>
        {job && (
          <optgroup label={t('thisJob')}>
            <option value={`job:${job.jobId}`}>
              {t('forJob', { title: job.title, company: job.company })}
            </option>
          </optgroup>
        )}
      </select>
    </label>
  );
}
