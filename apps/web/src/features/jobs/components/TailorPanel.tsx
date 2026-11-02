import type { TailoredResume } from '@jobsearch/data';
import {
  getErrorMessage,
  tailoredPdfUrl,
  useTailoredResume,
  useTailorResume,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';

const BUTTON =
  'rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60';
const LINK =
  'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700';

/**
 * Tailoring inside the job popup: Resume-Matcher rewrites your resume for this job and writes a
 * cover letter (a minute or three), then both download as PDFs.
 */
export function TailorPanel({ jobId }: { jobId: string }) {
  const tailored = useTailoredResume(jobId);
  const start = useTailorResume();
  const t = useTranslations('Jobs.tailor');
  const data = tailored.data;
  const pending = start.isPending || data?.status === 'PENDING';

  const startButton = (label: string) => (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        start.mutate(jobId);
      }}
      className={BUTTON}
    >
      {label}
    </button>
  );

  return (
    <section
      aria-labelledby="tailor-title"
      className="space-y-3 border-b border-slate-200 px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="tailor-title" className="text-sm font-semibold text-slate-900">
          {t('title')}
        </h3>
        {data?.status === 'READY' && startButton(t('again'))}
      </div>

      {/* aria-live announces progress and the result to screen readers. */}
      <div aria-live="polite" className="space-y-3">
        {tailored.isPending ? (
          <p className="text-sm text-slate-500">{t('loading')}</p>
        ) : pending ? (
          <p className="text-sm text-slate-700">{t('pending')}</p>
        ) : !data ? (
          <div className="flex flex-wrap items-center gap-3">
            {startButton(t('start'))}
            <span className="text-xs text-slate-500">{t('startHint')}</span>
          </div>
        ) : data.status === 'FAILED' ? (
          <div className="space-y-2">
            <p className="text-sm text-red-700">{data.error ?? t('failed')}</p>
            {startButton(t('tryAgain'))}
          </div>
        ) : (
          <TailorResult jobId={jobId} tailored={data} />
        )}
        {start.isError && (
          <p role="alert" className="text-sm text-red-700">
            {getErrorMessage(start.error)}
          </p>
        )}
      </div>
    </section>
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
