import type { JobInsights } from '@jobsearch/data';
import {
  getErrorMessage,
  jobResumeUrl,
  useDeleteJobResume,
  useSaveJobResumeText,
  useUploadJobResume,
} from '@jobsearch/data';
import { useState } from 'react';
import { Badge } from './Badge';
import { scoreTone } from './MatchPanel';

const BUTTON =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

/** Upload a file or paste text. Both replace the resume saved before. */
function ResumeInput({ jobId, onSaved }: { jobId: string; onSaved: () => void }) {
  const upload = useUploadJobResume();
  const save = useSaveJobResumeText();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const busy = upload.isPending || save.isPending;
  const error = upload.error ?? save.error;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${BUTTON} cursor-pointer`}>
          {upload.isPending ? 'Uploading…' : 'Upload file'}
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            aria-label="Upload resume for this job"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) upload.mutate({ jobId, file }, { onSuccess: onSaved });
            }}
          />
        </label>
        <button
          type="button"
          className={BUTTON}
          aria-expanded={pasting}
          onClick={() => {
            setPasting((open) => !open);
          }}
        >
          Paste text
        </button>
        <span className="text-xs text-slate-500">PDF, Word, text or Markdown</span>
      </div>
      {pasting && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              { jobId, text },
              {
                onSuccess: () => {
                  setText('');
                  setPasting(false);
                  onSaved();
                },
              },
            );
          }}
        >
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            aria-label="Resume text for this job"
            placeholder="Paste the resume Claude wrote for you"
            rows={8}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save and score'}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          Could not save it: {getErrorMessage(error)}
        </p>
      )}
    </div>
  );
}

function Terms({ label, terms, tone }: { label: string; terms: string[]; tone: 'green' | 'red' }) {
  if (terms.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-slate-500">{label}:</span>
      <ul className="flex flex-wrap gap-1" aria-label={label}>
        {terms.map((term) => (
          <li key={term}>
            <Badge tone={tone}>{term}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The resume you wrote for this job (with the copied prompt), uploaded or pasted back. It is
 * scored like your profile resume, so you see the score before and after, and what it fixed.
 */
export function JobResumePanel({ insights }: { insights: JobInsights }) {
  const { jobId, jobResume, score: before } = insights;
  const remove = useDeleteJobResume();
  const [replacing, setReplacing] = useState(false);

  return (
    <section
      aria-label="Your resume for this job"
      className="space-y-2 rounded-md border border-slate-200 bg-white p-3"
    >
      <h4 className="text-xs font-medium text-slate-500 uppercase">Your resume for this job</h4>
      {jobResume ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-slate-700">
              {jobResume.fileName ?? 'Pasted text'}
              <span className="text-slate-400">
                {' '}
                · saved {new Date(jobResume.updatedAt).toLocaleDateString()}
              </span>
            </span>
            {jobResume.score !== null && (
              <span className="flex items-center gap-1.5" aria-label="Score before and after">
                <span className="text-slate-600">Before</span>
                {before === null ? (
                  <Badge>n/a</Badge>
                ) : (
                  <Badge tone={scoreTone(before)}>{before}%</Badge>
                )}
                <span aria-hidden>→</span>
                <span className="text-slate-600">After</span>
                <Badge tone={scoreTone(jobResume.score)}>{jobResume.score}%</Badge>
              </span>
            )}
          </div>
          <Terms label="Now covered" terms={jobResume.nowCovered} tone="green" />
          <Terms label="Still missing" terms={jobResume.stillMissing} tone="red" />
          <div className="flex flex-wrap items-center gap-2">
            <a href={jobResumeUrl(jobId)} download className={BUTTON}>
              Download
            </a>
            <button
              type="button"
              className={BUTTON}
              aria-expanded={replacing}
              onClick={() => {
                setReplacing((open) => !open);
              }}
            >
              Replace
            </button>
            <button
              type="button"
              className={`${BUTTON} text-red-700`}
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate(jobId);
              }}
            >
              Delete
            </button>
          </div>
          {remove.error && (
            <p role="alert" className="text-red-700">
              Could not delete it: {getErrorMessage(remove.error)}
            </p>
          )}
          {replacing && (
            <ResumeInput
              jobId={jobId}
              onSaved={() => {
                setReplacing(false);
              }}
            />
          )}
        </>
      ) : (
        <>
          <p className="text-slate-600">
            Wrote a resume with the prompt? Upload or paste it here to see its score next to your
            profile resume, and keep it with this job.
          </p>
          <ResumeInput jobId={jobId} onSaved={() => undefined} />
        </>
      )}
    </section>
  );
}
