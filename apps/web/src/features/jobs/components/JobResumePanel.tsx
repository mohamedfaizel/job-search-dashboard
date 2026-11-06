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
import { replyParts } from '../reply';
import { useJobFormat } from '../useJobFormat';
import { Badge } from './Badge';
import { ClaudeNotes } from './ClaudeNotes';
import { ScoreRing } from './InsightsPanel';
import { scoreTone } from './MatchPanel';
import type { ReplyPart } from './ReplyPreview';
import { ICON, SVG, SavedReplyPreview } from './ReplyPreview';

export const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export const PRIMARY =
  'inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50';
const LINK = 'text-brand-700 hover:underline';

const ACCEPT = '.pdf,.docx,.txt,.md';
const isResumeFile = (file: File) => /\.(pdf|docx|txt|md)$/i.test(file.name);

/**
 * Brings Claude's reply back: one click reads it from the clipboard, or paste it in the box,
 * upload a file or drop one. Each replaces the reply saved before and is scored. Nothing
 * downloads here: you check the PDF and download it in step 3.
 */
export function ReplyInput({ jobId, onSaved }: { jobId: string; onSaved: () => void }) {
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
          toast(tToast('replySaved'));
          onSaved();
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
          onSaved();
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
 * is saved (a new `savedAt`) or the template changes; `run` checks again.
 */
function usePdfCheck(jobId: string, template: string, savedAt: string) {
  const check = useCheckResumePdf();
  const { mutate } = check;
  useEffect(() => {
    mutate({ jobId, template });
  }, [mutate, jobId, template, savedAt]);
  const result = check.data?.template === template ? check.data : null;
  const items = result
    ? PDF_CHECKS.map((code) => result.items.find((item) => item.code === code)).filter(
        (item): item is PdfCheckItem => item !== undefined,
      )
    : [];
  return {
    pending: check.isPending,
    error: check.error,
    done: result !== null,
    problems: items.filter((item) => !item.ok),
    passed: items.filter((item) => item.ok),
    run: () => {
      check.mutate({ jobId, template });
    },
  };
}
type PdfCheckState = ReturnType<typeof usePdfCheck>;

function usePdfLine() {
  const t = useTranslations('Jobs.reply');
  return (item: PdfCheckItem) => {
    const [pages = '', limit = ''] = item.detail.split('/');
    const values = { detail: item.detail, pages, limit };
    return t(item.ok ? `pdfOk.${item.code}` : `pdfBad.${item.code}`, values);
  };
}

/** The PDF check as one small pill: "✓ ATS OK", or how many things to fix. */
function PdfPill({ pdf }: { pdf: PdfCheckState }) {
  const t = useTranslations('Jobs.reply');
  const bad = pdf.problems.length;
  return (
    <span
      role="status"
      aria-label={t('pdfTitle')}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        !pdf.done
          ? 'bg-slate-100 text-slate-500'
          : bad
            ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-300 ring-inset'
            : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {pdf.pending
        ? t('pdfChecking')
        : !pdf.done
          ? t('pdfNotYet')
          : bad
            ? `! ${t('pdfProblems', { count: bad })}`
            : `✓ ${t('pdfOkShort')}`}
    </span>
  );
}

/** Under the Resume bar: what to fix, and the passed checks behind a click. */
function PdfNotice({ pdf }: { pdf: PdfCheckState }) {
  const t = useTranslations('Jobs.reply');
  const errorText = useErrorText();
  const line = usePdfLine();
  if (pdf.error) {
    return (
      <p
        role="alert"
        className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700"
      >
        {t('pdfError', { error: errorText(pdf.error) })}
      </p>
    );
  }
  if (!pdf.done || (pdf.problems.length === 0 && pdf.passed.length === 0)) return null;
  const bad = pdf.problems.length > 0;
  return (
    <section
      aria-label={t('pdfTitle')}
      className={`space-y-1 border-b px-3 py-1.5 text-xs ${
        bad ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'
      }`}
    >
      {bad && (
        <ul className="space-y-0.5 text-sm" aria-label={t('pdfProblemsLabel')}>
          {pdf.problems.map((item) => (
            <li key={item.code} className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-amber-600">
                !
              </span>
              <span>{line(item)}</span>
            </li>
          ))}
        </ul>
      )}
      {pdf.passed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-slate-500 hover:text-slate-800">
            {t('pdfDetails', { count: pdf.passed.length })}
          </summary>
          <ul className="mt-1 space-y-0.5" aria-label={t('pdfAllLabel')}>
            {pdf.passed.map((item) => (
              <li key={item.code} className="flex gap-2 text-slate-700">
                <span aria-hidden="true" className="text-emerald-600">
                  ✓
                </span>
                <span>{line(item)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const ICONS = {
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  word: <path d="M4 5l3 14 5-10 5 10 3-14" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  again: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </>
  ),
  replace: (
    <>
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M20 10A8 8 0 0 0 6 6L4 10M4 14a8 8 0 0 0 14 4l2-4" />
    </>
  ),
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />,
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
};

function Icon({ name, spin = false }: { name: keyof typeof ICONS; spin?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${SVG} ${spin ? 'animate-spin' : ''}`}>
      {ICONS[name]}
    </svg>
  );
}

/** A download link drawn as an icon; its name shows as a tooltip. */
function DownloadIcon({
  href,
  label,
  hint = label,
  icon = 'download',
}: {
  href: string;
  label: string;
  /** The tooltip, when it says more than the name. */
  hint?: string;
  icon?: keyof typeof ICONS;
}) {
  return (
    <a href={href} download aria-label={label} title={hint} className={ICON}>
      <Icon name={icon} />
    </a>
  );
}

/** Copies a text; says so in a toast, or that the clipboard is blocked. */
function CopyIcon({ text, label }: { text: string; label: string }) {
  const t = useTranslations('Jobs.reply');
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={ICON}
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => {
            toast(t('copiedToast'));
          },
          () => {
            toast(t('copyBlocked'));
          },
        );
      }}
    >
      <Icon name="copy" />
    </button>
  );
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

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
 * The reply you saved for this job: Claude's questions, the score before and after, then the
 * preview with one tab per part. Each tab carries its own buttons (download, copy); the PDF check
 * is a pill on the Resume tab and an orange "!" when something needs fixing.
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
  const pdf = usePdfCheck(jobId, chosen, jobResume?.updatedAt ?? '');
  if (!jobResume) return null;
  const base = jobResumeUrl(jobId);

  const tools = (part: ReplyPart) => {
    if (part === 'resume') {
      return (
        <>
          <PdfPill pdf={pdf} />
          <span className="flex-1" />
          {templates.data?.rendererAvailable && (
            <select
              aria-label={t('templateLabel')}
              value={chosen}
              onChange={(e) => {
                setTemplate(e.target.value);
              }}
              className="h-7 rounded border border-slate-300 bg-white px-1 text-xs"
            >
              {templates.data.resumeTemplates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          )}
          <DownloadIcon
            href={`${base}/resume.pdf?template=${encodeURIComponent(chosen)}`}
            label={t('downloadPdf')}
          />
          {templates.data?.wordTemplate?.usable && (
            <DownloadIcon
              href={`${base}/resume.docx`}
              label={t('word')}
              hint={t('wordHint', { file: templates.data.wordTemplate.fileName })}
              icon="word"
            />
          )}
          {jobResume.fileName && (
            <DownloadIcon
              href={base}
              label={`${t('original')}: ${jobResume.fileName}`}
              icon="file"
            />
          )}
          <button
            type="button"
            aria-label={t('pdfAgain')}
            title={t('pdfAgain')}
            disabled={pdf.pending}
            onClick={pdf.run}
            className={ICON}
          >
            <Icon name="again" spin={pdf.pending} />
          </button>
        </>
      );
    }
    if (part === 'coverLetter') {
      return (
        <>
          <span className="text-xs text-slate-500">
            {t('words', { count: words(jobResume.coverLetter) })}
          </span>
          <span className="flex-1" />
          <DownloadIcon href={`${base}/cover-letter.pdf`} label={t('coverPdf')} />
          <CopyIcon text={jobResume.coverLetter} label={t('copyCover')} />
        </>
      );
    }
    return (
      <>
        <span className="flex-1" />
        <CopyIcon text={jobResume.formAnswers} label={t('copyAnswers')} />
      </>
    );
  };

  const tabsEnd = (
    <>
      <span className="text-xs text-slate-500" title={jobResume.fileName ?? t('pastedText')}>
        {t('saved', { date: f.date(jobResume.updatedAt) })}
      </span>
      <button
        type="button"
        aria-expanded={replacing}
        aria-label={t('replace')}
        title={t('replace')}
        className={ICON}
        onClick={() => {
          setReplacing((open) => !open);
        }}
      >
        <Icon name="replace" />
      </button>
      <button
        type="button"
        aria-label={t('delete')}
        title={t('delete')}
        disabled={remove.isPending}
        className={`${ICON} text-red-600 hover:text-red-700`}
        onClick={() => {
          remove.mutate(jobId);
        }}
      >
        <Icon name="trash" />
      </button>
    </>
  );

  return (
    <section aria-label={t('sectionLabel')} className="space-y-3">
      <ClaudeNotes
        key={jobResume.claudeCheck}
        jobId={jobId}
        text={jobResume.claudeCheck}
        resume={jobResume.text}
        answers={jobResume.claudeAnswers}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {jobResume.score !== null && (
          <div
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
              before === null || jobResume.score > before
                ? 'border-emerald-200 bg-emerald-50/70'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex flex-col items-center" aria-label={t('beforeAfter')}>
              <ScoreRing score={jobResume.score} size={44} />
              <span className="text-xs text-slate-600">
                {t('was', { before: before === null ? '–' : `${String(before)}%` })}
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {jobResume.nowCovered.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-emerald-900">{t('nowCovers')}</p>
                  <ul className="flex flex-wrap gap-1" aria-label={t('nowCoveredLabel')}>
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
      </div>

      {replacing && (
        <ReplyInput
          jobId={jobId}
          onSaved={() => {
            setReplacing(false);
          }}
        />
      )}
      {remove.error && (
        <p role="alert" className="text-red-700">
          {t('deleteError', { error: errorText(remove.error) })}
        </p>
      )}

      <SavedReplyPreview
        key={`preview-${jobResume.updatedAt}`}
        insights={insights}
        saved={jobResume}
        tools={tools}
        notice={(part) => (part === 'resume' ? <PdfNotice pdf={pdf} /> : null)}
        flagged={pdf.problems.length > 0 ? ['resume'] : []}
        tabsEnd={tabsEnd}
      />
    </section>
  );
}
