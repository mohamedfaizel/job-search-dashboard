import type { TailoredResume } from '@jobsearch/data';
import { tailoredPdfUrl, useTailoredResume, useTailorResume } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { AiRunSection } from './AiRunSection';

const LINK =
  'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700';

/**
 * Tailoring inside the job popup: Resume-Matcher rewrites your resume for this job and writes a
 * cover letter (a minute or three), then both download as PDFs.
 */
export function TailorPanel({ jobId }: { jobId: string }) {
  const query = useTailoredResume(jobId);
  const start = useTailorResume();
  return (
    <AiRunSection
      namespace="Jobs.tailor"
      titleId="tailor-title"
      loading={query.isPending}
      data={query.data}
      start={{
        ...start,
        mutate: () => {
          start.mutate(jobId);
        },
      }}
    >
      {(run) => <TailorResult jobId={jobId} tailored={run} />}
    </AiRunSection>
  );
}

function TailorResult({ jobId, tailored }: { jobId: string; tailored: TailoredResume }) {
  const t = useTranslations('Jobs.tailor');
  const file = tailored.resumeFileName ?? t('yourResume');
  return (
    <div className="space-y-3">
      {tailored.outdated && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('outdated')}</p>
      )}
      <p className="text-sm text-slate-700">
        {tailored.score === null
          ? t('from', { file })
          : t('fromScore', { file, score: Math.round(tailored.score) })}
      </p>
      <div className="flex flex-wrap gap-2">
        {/* Plain links: the browser downloads the file, sending the login cookie with it. */}
        <a href={tailoredPdfUrl(jobId, 'resume')} className={LINK}>
          {t('downloadResume')}
        </a>
        {tailored.coverLetter && (
          <a href={tailoredPdfUrl(jobId, 'cover-letter')} className={LINK}>
            {t('downloadCover')}
          </a>
        )}
      </div>
      {tailored.coverLetter ? (
        <details className="rounded-md border border-slate-200 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            {t('readCover')}
          </summary>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {tailored.coverLetter}
          </p>
        </details>
      ) : (
        <p className="text-sm text-slate-500">{t('noCover')}</p>
      )}
    </div>
  );
}
