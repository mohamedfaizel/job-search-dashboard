import type { BuilderPdf } from '@jobsearch/data';
import {
  useCoverLetterTemplatePdf,
  useJobCoverLetterPdf,
  useJobResumeBuildPdf,
  useMe,
  useResumeBuildPdf,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';

interface Props {
  language: string;
  /** Set for a job's resume copy: its own PDF instead of the master's. */
  jobId?: string;
  /** Changes after every save, so the preview shows the saved resume. */
  version: string;
  maxPages: number;
  /** Show the job's cover letter (or, without a job, your letter template) instead of a resume. */
  letter?: boolean;
  /** False while there is nothing to typeset yet (no letter written). */
  enabled?: boolean;
}

/**
 * The real PDF, the same file the download gives you, typeset in your template. It is made
 * again after each save. The meter shows the pages against your page limit from My profile.
 */
export function PdfPreview({
  language,
  jobId,
  version,
  maxPages,
  letter = false,
  enabled = true,
}: Props) {
  const t = useTranslations('Resume');
  // How to start the PDF maker is for admins; everyone else just reads that it is plain for now.
  const isAdmin = useMe().data?.role === 'ADMIN';
  const errorText = useErrorText();
  // Both hooks always run; only one of them has a request to make.
  const master = useResumeBuildPdf(jobId ? '' : language, version, !jobId && !letter);
  const job = useJobResumeBuildPdf(jobId ?? '', version, !!jobId && !letter);
  const letterPdf = useJobCoverLetterPdf(jobId ?? '', version, !!jobId && letter && enabled);
  const template = useCoverLetterTemplatePdf(language, version, !jobId && letter && enabled);
  const pdf = letter ? (jobId ? letterPdf : template) : jobId ? job : master;
  const url = useObjectUrl(pdf.data);
  const pages = pdf.data?.pages ?? 0;
  const over = pages > maxPages;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-slate-700">{t('pages')}</span>
        <div
          role="meter"
          aria-label={t('pagesMeter')}
          aria-valuemin={0}
          aria-valuemax={maxPages}
          aria-valuenow={pages}
          aria-valuetext={t('pagesOf', { pages, max: maxPages })}
          className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className={`h-full rounded-full ${over ? 'bg-red-600' : 'bg-emerald-600'}`}
            style={{ width: `${String(Math.min(100, (pages / maxPages) * 100))}%` }}
          />
        </div>
        <span className={`tabular-nums font-semibold ${over ? 'text-red-700' : 'text-slate-900'}`}>
          {pdf.data ? t('pagesOf', { pages, max: maxPages }) : '…'}
        </span>
        {pdf.isFetching && <span className="text-xs text-slate-500">{t('updating')}</span>}
      </div>
      {over && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
          {t(letter ? 'letterTooLong' : 'tooLong', { max: maxPages })}
        </p>
      )}
      {pdf.data && !pdf.data.styled && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t(isAdmin ? 'plainPreview' : 'plainPreviewUser')}
        </p>
      )}
      {pdf.isError && !pdf.data && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(pdf.error)}
        </p>
      )}
      {url ? (
        <iframe
          title={t('previewTitle')}
          src={`${url}#toolbar=0&navpanes=0&view=FitH`}
          className="h-[75vh] min-h-[480px] w-full rounded-md border border-slate-200 bg-white shadow-sm"
        />
      ) : (
        <div className="flex h-[60vh] items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-500">
          {pdf.isError ? '' : letter && !enabled ? t('noLetterYet') : t('makingPdf')}
        </div>
      )}
    </div>
  );
}

/** A blob: URL for the PDF, freed when a newer one replaces it. */
function useObjectUrl(pdf: BuilderPdf | undefined): string | null {
  const url = useMemo(
    () => (pdf && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(pdf.blob) : null),
    [pdf],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}
