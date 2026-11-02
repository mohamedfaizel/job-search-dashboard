import type { JobInsights } from '@jobsearch/data';
import {
  jobResumeUrl,
  useDeleteJobResume,
  useSaveJobResumeText,
  useDocumentStyle,
  useDocumentTemplates,
  useSetHaveTerm,
  useUploadJobResume,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { DragEvent } from 'react';
import { useRef, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { replyParts, startDownload } from '../reply';
import { useJobFormat } from '../useJobFormat';
import { CopyText } from './CopyText';
import { HaveChip, MissingChip, ScoreRing } from './InsightsPanel';

export const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export const PRIMARY =
  'inline-flex h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';
const LINK = 'text-indigo-700 hover:underline';

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
            dragging ? 'border-dashed border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white'
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
            className="h-9 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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

/**
 * The reply you saved for this job: the resume scored next to your master resume (before and
 * after), the files to attach, and the cover letter and form answers to copy.
 */
export function SavedReply({ insights }: { insights: JobInsights }) {
  const errorText = useErrorText();
  const { jobId, jobResume, score: before } = insights;
  const remove = useDeleteJobResume();
  const have = useSetHaveTerm();
  const templates = useDocumentTemplates();
  const style = useDocumentStyle();
  const [replacing, setReplacing] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);
  const t = useTranslations('Jobs.reply');
  const f = useJobFormat();
  const chosen = template ?? style.data?.resumeTemplate ?? 'classic';
  if (!jobResume) return null;
  const base = jobResumeUrl(jobId);
  // Terms you said you have ("I have it") that Claude's resume still leaves out.
  const yours = new Set(
    [...insights.skills, ...insights.keywords].filter((t) => t.youHave).map((t) => t.term),
  );
  const leftOut = jobResume.stillMissing.filter((term) => yours.has(term));
  // ✓ is for skills only: keywords are Claude's to work in.
  const skills = new Set(insights.skills.map((t) => t.term));

  return (
    <section aria-label={t('sectionLabel')} className="space-y-3">
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
            {jobResume.stillMissing.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-slate-600">{t('stillMissing')}</p>
                <ul className="flex flex-wrap gap-1.5" aria-label={t('stillMissing')}>
                  {jobResume.stillMissing.map((term) => (
                    <li key={term}>
                      {yours.has(term) ? (
                        <HaveChip
                          term={term}
                          onUndo={() => {
                            have.mutate({ jobId, term, have: false });
                          }}
                        />
                      ) : (
                        <MissingChip
                          term={term}
                          relatedTo={null}
                          onHave={
                            skills.has(term)
                              ? () => {
                                  have.mutate({ jobId, term, have: true });
                                }
                              : undefined
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {have.error && (
        <p role="alert" className="text-red-700">
          {t('changeError', { error: errorText(have.error) })}
        </p>
      )}

      {leftOut.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3">
          <CopyText
            label={t('copyUpdated')}
            text={insights.prompt}
            copiedHint={t('updatedHint')}
            boxLabel={t('updatedBox')}
            primary
          >
            <span className="text-sm text-sky-900">
              {t('leftOut', { terms: leftOut.join(', '), count: leftOut.length })}
            </span>
          </CopyText>
        </div>
      )}

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
