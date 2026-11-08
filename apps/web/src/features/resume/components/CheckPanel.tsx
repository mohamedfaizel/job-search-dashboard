import type { PdfCheckItem } from '@jobsearch/data';
import { useCheckResumePdf, useJobInsights } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { SMALL_BUTTON } from './ui';

interface Props {
  jobId: string;
  /** Changes with every save, so the PDF is checked again after it. */
  version: string;
}

const PDF_CHECKS = [
  'PAGES',
  'TEXT',
  'NAME',
  'EMAIL',
  'DATES',
  'CHARACTERS',
  'PLACEHOLDERS',
  'SKILLS',
] as const;

/**
 * Two checks of this job's saved resume, both free and without AI. Facts: numbers, skills and
 * language levels in it that are in nothing you told us (your master resume, profile, achievements).
 * PDF: what an ATS reads from the finished file.
 */
export function CheckPanel({ jobId, version }: Props) {
  const t = useTranslations('Resume.check');
  const pdfText = useTranslations('Jobs.reply');
  const errorText = useErrorText();
  const insights = useJobInsights(jobId);
  const pdf = useCheckResumePdf();
  const { mutate } = pdf;
  useEffect(() => {
    mutate({ jobId });
  }, [mutate, jobId, version]);

  const facts = insights.data?.jobResume?.factCheck;
  const items = PDF_CHECKS.map((code) => pdf.data?.items.find((item) => item.code === code)).filter(
    (item): item is PdfCheckItem => item !== undefined,
  );
  const line = (item: PdfCheckItem) => {
    const [pages = '', limit = ''] = item.detail.split('/');
    return pdfText(item.ok ? `pdfOk.${item.code}` : `pdfBad.${item.code}`, {
      detail: item.detail,
      pages,
      limit,
    });
  };

  return (
    <section
      aria-label={t('title')}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-slate-900">{t('title')}</h2>

      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {t('facts')}
        </h3>
        {facts === undefined || facts === null ? (
          <p className="text-xs text-slate-500">{t('noFacts')}</p>
        ) : facts.length === 0 ? (
          <p role="status" className="text-sm text-emerald-800">
            ✓ {t('factsOk')}
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">{t('factsHint')}</p>
            <ul className="space-y-1">
              {facts.map((f) => (
                <li
                  key={`${f.kind}-${f.text}-${f.context}`}
                  className="rounded-md bg-amber-50 px-2.5 py-1 text-sm text-amber-950"
                >
                  <strong>{f.text}</strong> <span className="text-amber-800">{f.context}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 className="mr-auto text-xs font-semibold uppercase tracking-wide text-slate-700">
            {t('pdf')}
          </h3>
          <button
            type="button"
            className={SMALL_BUTTON}
            disabled={pdf.isPending}
            onClick={() => {
              mutate({ jobId });
            }}
          >
            {pdf.isPending ? pdfText('pdfChecking') : pdfText('pdfAgain')}
          </button>
        </div>
        {pdf.isError && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(pdf.error)}
          </p>
        )}
        {items.length > 0 && (
          <ul className="space-y-1">
            {items.map((item) => (
              <li
                key={item.code}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  item.ok ? 'text-emerald-900' : 'bg-amber-50 text-amber-950'
                }`}
              >
                <span aria-hidden>{item.ok ? '✓ ' : '! '}</span>
                {line(item)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
