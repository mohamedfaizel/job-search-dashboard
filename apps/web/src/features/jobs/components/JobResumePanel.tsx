import type { JobInsights, PdfCheckItem } from '@jobsearch/data';
import {
  jobResumeUrl,
  useCheckResumePdf,
  useDeleteJobResume,
  useSaveJobResumeText,
  useDocumentStyle,
  useDocumentTemplates,
  useMatchJobResume,
  useUploadJobResume,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { DragEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../../components/Toasts';
import { useErrorText } from '../../../i18n/useErrorText';
import { replyParts, startDownload } from '../reply';
import { useJobFormat } from '../useJobFormat';
import { Badge } from './Badge';
import { ClaudeNotes } from './ClaudeNotes';
import { CopyText } from './CopyText';
import { ScoreRing } from './InsightsPanel';
import { scoreTone } from './MatchPanel';
import { SavedReplyPreview } from './ReplyPreview';

export const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export const PRIMARY =
  'inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50';
const LINK = 'text-brand-700 hover:underline';

const ACCEPT = '.pdf,.docx,.txt,.md';
const isResumeFile = (file: File) => /\.(pdf|docx|txt|md)$/i.test(file.name);

/**
 * Brings Claude's reply back: one click reads it from the clipboard, or paste it in the box,
 * upload a file or drop one. Each replaces the reply saved before. A pasted reply downloads
 * its resume PDF straight away, so pasting once gives you the file to attach.
 */
export function ReplyInput({
  jobId,
  onSaved,
}: {
  jobId: string;
  /** pdf is true when the resume PDF started downloading. */
  onSaved: (result: { pdf: boolean }) => void;
}) {
  const errorText = useErrorText();
  const upload = useUploadJobResume();
  const save = useSaveJobResumeText();
  const t = useTranslations('Jobs.reply');
  const tToast = useTranslations('Jobs.toasts');
  const toast = useToast();
  const [text, setText] = useState('');
  const [clipboardBlocked, setClipboardBlocked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const busy = upload.isPending || save.isPending;
  const error = upload.error ?? save.error;
  const parts = replyParts(text);

  const saveText = (value: string) => {
    save.mutate(
      { jobId, text: value },
      {
        onSuccess: () => {
          setText('');
          startDownload(`${jobResumeUrl(jobId)}/resume.pdf`);
          toast(tToast('replySaved'));
          onSaved({ pdf: true });
        },
      },
    );
  };
  const uploadFile = (file: File) => {
    upload.mutate(
      { jobId, file },
      {
        onSuccess: () => {
          toast(tToast('resumeUploaded'));
          onSaved({ pdf: false });
        },
      },
    );
  };

  // Reading the clipboard asks for permission once. When it is blocked, paste in the box.
  const pasteFromClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (value.trim()) {
        saveText(value);
        return;
      }
    } catch {
      setClipboardBlocked(true);
    }
    box.current?.focus();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isResumeFile(file)) uploadFile(file);
    else if (!file && e.dataTransfer.getData('text').trim())
      setText(e.dataTransfer.getData('text'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          className={PRIMARY}
          disabled={busy}
          onClick={() => {
            void pasteFromClipboard();
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-none stroke-current stroke-2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="8" y="3" width="8" height="4" rx="1" />
            <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
          </svg>
          {save.isPending ? t('making') : t('paste')}
        </button>
        <span className="text-sm text-slate-600">{t('pasteHint')}</span>
      </div>
      {clipboardBlocked && <p className="text-xs text-slate-500">{t('blocked')}</p>}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveText(text);
        }}
      >
        {/* The box also takes a dropped file: the "upload a file" link does the same. */}
        <textarea
          ref={box}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={onDrop}
          aria-label={t('boxLabel')}
          placeholder={t('placeholder')}
          rows={7}
          className={`w-full rounded-xl border-[1.5px] p-3 text-sm ${
            dragging ? 'border-dashed border-brand-400 bg-brand-50' : 'border-slate-300 bg-white'
          }`}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ul aria-label={t('foundLabel')} className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                [t('resume'), parts.resume],
                [t('coverLetter'), parts.coverLetter],
                [t('formAnswers'), parts.formAnswers],
              ] as const
            ).map(([label, found]) => (
              <li
                key={label}
                className={`rounded-md px-2 py-0.5 ring-1 ring-inset ${
                  found
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                    : 'bg-slate-50 text-slate-500 ring-slate-200'
                }`}
              >
                {found ? '✓' : '–'} {label}
                <span className="sr-only">{found ? t('found') : t('notFound')}</span>
              </li>
            ))}
          </ul>
          <span className="flex-1" />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="h-9 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {save.isPending ? t('saving') : t('saveDownload')}
          </button>
        </div>
      </form>

      <p className="text-sm text-slate-600">
        {t('haveFile')}{' '}
        <label className={`${LINK} cursor-pointer`}>
          {upload.isPending ? t('uploading') : t('upload')}
          <input
            type="file"
            accept={ACCEPT}
            aria-label={t('uploadLabel')}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) uploadFile(file);
            }}
          />
        </label>{' '}
        {t('fileTypes')}
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {t('saveError', { error: errorText(error) })}
        </p>
      )}
    </div>
  );
}

function FileRow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0 fill-none stroke-red-600 stroke-[1.8]"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
      </svg>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="flex shrink-0 gap-3">{children}</span>
    </div>
  );
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
 * Checks the finished PDF the way an ATS reads it: only its text. It runs by itself when a reply
 * is saved, because it typesets the PDF first; the button runs it again.
 */
function PdfCheck({ jobId, template }: { jobId: string; template: string }) {
  const t = useTranslations('Jobs.reply');
  const errorText = useErrorText();
  const check = useCheckResumePdf();
  const result = check.data?.template === template ? check.data : null;
  // One step: the check runs by itself when the reply is saved (this panel is remounted for each
  // saved reply) or the template changes. The button is only for running it again.
  const { mutate } = check;
  useEffect(() => {
    mutate({ jobId, template });
  }, [mutate, jobId, template]);
  const line = (item: PdfCheckItem) => {
    const [pages = '', limit = ''] = item.detail.split('/');
    const values = { detail: item.detail, pages, limit };
    return t(item.ok ? `pdfOk.${item.code}` : `pdfBad.${item.code}`, values);
  };
  const problems = result?.items.filter((item) => !item.ok).length ?? 0;
  return (
    <section
      aria-label={t('pdfTitle')}
      className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-slate-900">{t('pdfTitle')}</h3>
        <button
          type="button"
          className={BUTTON}
          disabled={check.isPending}
          onClick={() => {
            check.mutate({ jobId, template });
          }}
        >
          {check.isPending ? t('pdfChecking') : result ? t('pdfAgain') : t('pdfRun')}
        </button>
        {result && (
          <span
            role="status"
            className={`text-sm ${problems ? 'text-amber-800' : 'text-emerald-700'}`}
          >
            {problems ? t('pdfProblems', { count: problems }) : t('pdfAllOk')}
          </span>
        )}
      </div>
      {!result && !check.isPending && <p className="text-xs text-slate-600">{t('pdfIntro')}</p>}
      {check.error && (
        <p role="alert" className="text-sm text-red-700">
          {t('pdfError', { error: errorText(check.error) })}
        </p>
      )}
      {result && (
        <ul className="space-y-1" aria-label={t('pdfTitle')}>
          {PDF_CHECKS.map((code) => result.items.find((item) => item.code === code))
            .filter((item): item is PdfCheckItem => item !== undefined)
            .map((item) => (
              <li
                key={item.code}
                className={`flex gap-2 text-sm ${item.ok ? 'text-slate-700' : 'text-amber-900'}`}
              >
                <span
                  aria-hidden="true"
                  className={item.ok ? 'text-emerald-600' : 'text-amber-600'}
                >
                  {item.ok ? '✓' : '!'}
                </span>
                <span>{line(item)}</span>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Resume-Matcher's ATS score for the resume Claude wrote (the "AI match" of the popup, but for
 * this resume instead of your master resume). It needs AI credits and a minute or two, so it
 * runs when you ask. Saving the resume again clears it, as the score would no longer fit.
 */
function AiMatch({ jobId, jobResume }: { jobId: string; jobResume: JobResumeScore }) {
  const t = useTranslations('Jobs.reply');
  const errorText = useErrorText();
  const start = useMatchJobResume();
  const { aiStatus, aiScore, aiError } = jobResume;
  const running = aiStatus === 'PENDING' || start.isPending;
  const ready = aiStatus === 'READY' && aiScore !== null;
  const run = () => {
    start.mutate(jobId);
  };
  const missing = ready ? jobResume.aiMissing : [];
  const tips = ready ? jobResume.aiTips : [];
  return (
    <section
      aria-label={t('aiTitle')}
      className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">{t('aiTitle')}</p>
        {ready && (
          <Badge tone={scoreTone(aiScore)}>
            <span aria-label={t('aiScoreLabel', { score: Math.round(aiScore) })}>
              {Math.round(aiScore)}
            </span>
          </Badge>
        )}
        <button type="button" className={`${BUTTON} ml-auto`} disabled={running} onClick={run}>
          {running ? t('aiWait') : ready || aiStatus === 'FAILED' ? t('aiAgain') : t('aiRun')}
        </button>
      </div>
      {!ready && <p className="text-xs text-slate-600">{running ? t('aiRunning') : t('aiHint')}</p>}
      {ready && missing.length === 0 && tips.length === 0 && (
        <p className="text-xs text-emerald-700">{t('aiNothingMissing')}</p>
      )}
      {missing.length > 0 && (
        <p className="text-xs text-slate-600">{t('aiMissingCards', { count: missing.length })}</p>
      )}
      {tips.length > 0 && (
        <details className="text-xs text-slate-700">
          <summary className="cursor-pointer text-slate-600">
            {t('aiTips', { count: tips.length })}
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </details>
      )}
      {aiStatus === 'FAILED' && (
        <p role="alert" className="text-xs text-red-700">
          {aiError ?? t('aiFailed')}
        </p>
      )}
      {start.error && (
        <p role="alert" className="text-xs text-red-700">
          {errorText(start.error)}
        </p>
      )}
    </section>
  );
}

type JobResumeScore = NonNullable<JobInsights['jobResume']>;

/**
 * The reply you saved for this job: the resume scored next to your master resume (before and
 * after), the files to attach, and the cover letter and form answers to copy.
 */
export function SavedReply({ insights }: { insights: JobInsights }) {
  const errorText = useErrorText();
  const { jobId, jobResume, score: before } = insights;
  const remove = useDeleteJobResume();
  const templates = useDocumentTemplates();
  const style = useDocumentStyle();
  const [replacing, setReplacing] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);
  const t = useTranslations('Jobs.reply');
  const f = useJobFormat();
  const chosen = template ?? style.data?.resumeTemplate ?? 'classic';
  if (!jobResume) return null;
  const base = jobResumeUrl(jobId);

  return (
    <section aria-label={t('sectionLabel')} className="space-y-3">
      <ClaudeNotes
        key={jobResume.claudeCheck}
        jobId={jobId}
        text={jobResume.claudeCheck}
        answers={jobResume.claudeAnswers}
      />
      <SavedReplyPreview
        key={`preview-${jobResume.updatedAt}`}
        insights={insights}
        saved={jobResume}
      />

      {jobResume.score !== null && (
        <div
          className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
            before === null || jobResume.score > before
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex flex-col items-center" aria-label={t('beforeAfter')}>
            <ScoreRing score={jobResume.score} size={52} />
            <span className="text-xs text-slate-600">
              {t('was', { before: before === null ? '–' : `${String(before)}%` })}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {jobResume.nowCovered.length > 0 && (
              <>
                <p className="text-sm font-semibold text-emerald-900">{t('nowCovers')}</p>
                <ul className="flex flex-wrap gap-1.5" aria-label={t('nowCoveredLabel')}>
                  {jobResume.nowCovered.map((term) => (
                    <li
                      key={term}
                      className="rounded-md bg-white px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200 ring-inset"
                    >
                      {term}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      <AiMatch jobId={jobId} jobResume={jobResume} />

      <div className="grid gap-2 sm:grid-cols-2">
        <FileRow name={t('resumePdf')}>
          {templates.data?.rendererAvailable && (
            <select
              aria-label={t('templateLabel')}
              value={chosen}
              onChange={(e) => {
                setTemplate(e.target.value);
              }}
              className="h-7 rounded border border-slate-300 bg-white px-1 text-xs"
            >
              {templates.data.resumeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <a
            href={`${base}/resume.pdf?template=${encodeURIComponent(chosen)}`}
            download
            className={LINK}
          >
            {t('downloadPdf')}
          </a>
          {templates.data?.wordTemplate?.usable && (
            <a
              href={`${base}/resume.docx`}
              download
              className={LINK}
              title={t('wordHint', { file: templates.data.wordTemplate.fileName })}
            >
              {t('word')}
            </a>
          )}
          {jobResume.fileName && (
            <a href={base} download className={LINK} title={jobResume.fileName}>
              {t('original')}
            </a>
          )}
        </FileRow>
        {jobResume.coverLetter && (
          <FileRow name={t('coverLetter')}>
            <a href={`${base}/cover-letter.pdf`} download className={LINK}>
              {t('pdf')}
            </a>
          </FileRow>
        )}
      </div>

      <PdfCheck key={jobResume.updatedAt} jobId={jobId} template={chosen} />

      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {jobResume.coverLetter && (
          <CopyText
            label={t('copyCover')}
            text={jobResume.coverLetter}
            copiedHint={t('coverHint')}
            boxLabel={t('coverLetter')}
          />
        )}
        {jobResume.formAnswers && (
          <CopyText
            label={t('copyAnswers')}
            text={jobResume.formAnswers}
            copiedHint={t('answersHint')}
            boxLabel={t('formAnswers')}
          />
        )}
      </div>

      <p className="text-xs text-slate-500">
        {jobResume.fileName ?? t('pastedText')} ·{' '}
        {t('saved', { date: f.date(jobResume.updatedAt) })} ·{' '}
        <button
          type="button"
          className={LINK}
          aria-expanded={replacing}
          onClick={() => {
            setReplacing((open) => !open);
          }}
        >
          {t('replace')}
        </button>{' '}
        ·{' '}
        <button
          type="button"
          className="text-red-700 hover:underline disabled:opacity-50"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(jobId);
          }}
        >
          {t('delete')}
        </button>
      </p>
      {remove.error && (
        <p role="alert" className="text-red-700">
          {t('deleteError', { error: errorText(remove.error) })}
        </p>
      )}
      {replacing && (
        <ReplyInput
          jobId={jobId}
          onSaved={() => {
            setReplacing(false);
          }}
        />
      )}
    </section>
  );
}
