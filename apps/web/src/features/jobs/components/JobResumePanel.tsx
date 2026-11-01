import type { JobInsights } from '@jobsearch/data';
import {
  getErrorMessage,
  jobResumeUrl,
  useDeleteJobResume,
  useSaveJobResumeText,
  useDocumentStyle,
  useDocumentTemplates,
  useSetHaveTerm,
  useUploadJobResume,
} from '@jobsearch/data';
import type { DragEvent } from 'react';
import { useRef, useState } from 'react';
import { replyParts, startDownload } from '../reply';
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
  const upload = useUploadJobResume();
  const save = useSaveJobResumeText();
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
          {save.isPending ? 'Making your PDF…' : 'Paste reply and get PDF'}
        </button>
        <span className="text-sm text-slate-600">
          One click: saves the reply, downloads the PDF.
        </span>
      </div>
      {clipboardBlocked && (
        <p className="text-xs text-slate-500">
          The browser didn’t let us read the clipboard. Paste the reply in the box below instead
          (Ctrl+V).
        </p>
      )}

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
          aria-label="Claude’s reply"
          placeholder="Or paste Claude’s whole reply here, or drop a PDF, Word, text or Markdown file"
          rows={7}
          className={`w-full rounded-xl border-[1.5px] p-3 text-sm ${
            dragging ? 'border-dashed border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white'
          }`}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ul aria-label="Found in the reply" className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ['Resume', parts.resume],
                ['Cover letter', parts.coverLetter],
                ['Form answers', parts.formAnswers],
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
                <span className="sr-only">{found ? ' found' : ' not found'}</span>
              </li>
            ))}
          </ul>
          <span className="flex-1" />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="h-9 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save and download PDF'}
          </button>
        </div>
      </form>

      <p className="text-sm text-slate-600">
        Have a file instead?{' '}
        <label className={`${LINK} cursor-pointer`}>
          {upload.isPending ? 'Uploading…' : 'Upload a file'}
          <input
            type="file"
            accept={ACCEPT}
            aria-label="Upload resume for this job"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) uploadFile(file);
            }}
          />
        </label>{' '}
        (PDF, Word, text or Markdown).
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          Could not save it: {getErrorMessage(error)}
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
  const { jobId, jobResume, score: before } = insights;
  const remove = useDeleteJobResume();
  const have = useSetHaveTerm();
  const templates = useDocumentTemplates();
  const style = useDocumentStyle();
  const [replacing, setReplacing] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);
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
    <section aria-label="Your resume for this job" className="space-y-3">
      {jobResume.score !== null && (
        <div
          className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
            before === null || jobResume.score > before
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex flex-col items-center" aria-label="Score before and after">
            <ScoreRing score={jobResume.score} size={52} />
            <span className="text-xs text-slate-600">
              was {before === null ? 'n/a' : `${String(before)}%`}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {jobResume.nowCovered.length > 0 && (
              <>
                <p className="text-sm font-semibold text-emerald-900">
                  The resume for this job now covers
                </p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Now covered">
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
                <p className="text-xs text-slate-600">Still missing</p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Still missing">
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
          Could not change that: {getErrorMessage(have.error)}
        </p>
      )}

      {leftOut.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3">
          <CopyText
            label="Copy updated prompt"
            text={insights.prompt}
            copiedHint="Paste it into Claude, then Replace this reply with the new one."
            boxLabel="Updated prompt"
            primary
          >
            <span className="text-sm text-sky-900">
              Claude’s resume leaves out {leftOut.join(', ')}, which you have. The updated prompt
              says {leftOut.length === 1 ? 'it' : 'they'} must be in.
            </span>
          </CopyText>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <FileRow name="Resume (PDF)">
          {templates.data?.rendererAvailable && (
            <select
              aria-label="Resume template"
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
            Download PDF
          </a>
          {templates.data?.wordTemplate?.usable && (
            <a
              href={`${base}/resume.docx`}
              download
              className={LINK}
              title={`In the layout of ${templates.data.wordTemplate.fileName}, to edit in Word`}
            >
              Word
            </a>
          )}
          {jobResume.fileName && (
            <a href={base} download className={LINK} title={jobResume.fileName}>
              Original
            </a>
          )}
        </FileRow>
        {jobResume.coverLetter && (
          <FileRow name="Cover letter">
            <a href={`${base}/cover-letter.pdf`} download className={LINK}>
              PDF
            </a>
          </FileRow>
        )}
      </div>

      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {jobResume.coverLetter && (
          <CopyText
            label="Copy cover letter"
            text={jobResume.coverLetter}
            copiedHint="Paste it where the form asks for one."
            boxLabel="Cover letter"
          />
        )}
        {jobResume.formAnswers && (
          <CopyText
            label="Copy form answers"
            text={jobResume.formAnswers}
            copiedHint="Claude in Chrome reads them from the Apply kit page too."
            boxLabel="Form answers"
          />
        )}
      </div>

      <p className="text-xs text-slate-500">
        {jobResume.fileName ?? 'Pasted text'} · saved{' '}
        {new Date(jobResume.updatedAt).toLocaleDateString()} ·{' '}
        <button
          type="button"
          className={LINK}
          aria-expanded={replacing}
          onClick={() => {
            setReplacing((open) => !open);
          }}
        >
          Replace
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
          Delete
        </button>
      </p>
      {remove.error && (
        <p role="alert" className="text-red-700">
          Could not delete it: {getErrorMessage(remove.error)}
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
