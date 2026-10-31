import type { LanguageResume, Profile } from '@jobsearch/data';
import {
  getErrorMessage,
  RESUME_LANGUAGES,
  useDeleteLanguageResume,
  useSaveLanguageResume,
  useTranslationPrompt,
  useUploadLanguageResume,
} from '@jobsearch/data';
import { useId, useState } from 'react';
import { inputClass } from './Field';

const CLAUDE_URL = 'https://claude.ai/new';
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.docx';
const BUTTON =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const PRIMARY =
  'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';

const SELECT = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm';

const nameOf = (code: string) => RESUME_LANGUAGES[code] ?? code;

/** "Upload a PDF or Word file" for one language. */
function UploadButton({ language, onDone }: { language: string; onDone?: () => void }) {
  const upload = useUploadLanguageResume();
  const id = useId();
  const [tooBig, setTooBig] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label
        htmlFor={id}
        className={`${BUTTON} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-500`}
      >
        {upload.isPending ? 'Reading it…' : 'Upload a file (PDF, Word)'}
        <input
          id={id}
          type="file"
          accept={ACCEPT}
          aria-label={`Upload your ${nameOf(language)} resume`}
          disabled={upload.isPending}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setTooBig(file.size > MAX_BYTES);
            if (file.size > MAX_BYTES) return;
            upload.mutate({ language, file }, { onSuccess: () => onDone?.() });
          }}
        />
      </label>
      {(tooBig || upload.isError) && (
        <span role="alert" className="text-sm text-red-700">
          {tooBig ? 'That file is over 5 MB.' : getErrorMessage(upload.error)}
        </span>
      )}
    </span>
  );
}

/** One saved resume in another language: edit the text, replace it with a file, or delete it. */
function SavedResume({ resume }: { resume: LanguageResume }) {
  const save = useSaveLanguageResume();
  const remove = useDeleteLanguageResume();
  const [text, setText] = useState(resume.text);
  const name = nameOf(resume.language);
  const boxId = useId();

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-slate-900">{name}</h3>
        <span className="text-xs text-slate-500">
          {resume.fileName ?? 'Pasted text'} · saved{' '}
          {new Date(resume.updatedAt).toLocaleDateString()}
        </span>
      </div>
      <label htmlFor={boxId} className="sr-only">
        {name} resume text
      </label>
      <textarea
        id={boxId}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        rows={10}
        className={`${inputClass} font-mono`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={PRIMARY}
          disabled={save.isPending || text === resume.text || !text.trim()}
          onClick={() => {
            save.mutate({ language: resume.language, text });
          }}
        >
          {save.isPending ? 'Saving…' : `Save ${name} resume`}
        </button>
        <UploadButton language={resume.language} />
        <button
          type="button"
          className="text-sm text-red-700 hover:underline disabled:opacity-50"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(resume.language);
          }}
        >
          Delete
        </button>
      </div>
      {(save.error ?? remove.error) && (
        <p role="alert" className="text-sm text-red-700">
          {getErrorMessage(save.error ?? remove.error)}
        </p>
      )}
    </div>
  );
}

/**
 * Adds your resume in one more language: translate the master resume with Claude (one prompt,
 * facts and language levels kept), then paste the answer or upload a file you already have.
 */
function AddResume({ languages }: { languages: string[] }) {
  const [language, setLanguage] = useState(languages.includes('de') ? 'de' : (languages[0] ?? ''));
  const [text, setText] = useState('');
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const prompt = useTranslationPrompt(language);
  const save = useSaveLanguageResume();
  const selectId = useId();
  const boxId = useId();
  const name = nameOf(language);

  const copyPrompt = async () => {
    setCopied(null);
    const { data } = await prompt.refetch();
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
    window.open(CLAUDE_URL, '_blank', 'noopener');
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed border-slate-300 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          Add your resume in
        </label>
        <select
          id={selectId}
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setCopied(null);
          }}
          className={SELECT}
        >
          {languages.map((code) => (
            <option key={code} value={code}>
              {nameOf(code)}
            </option>
          ))}
        </select>
      </div>

      <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
        <li className="space-y-2">
          <p>
            No {name} resume yet? Let Claude translate your master resume. The prompt keeps every
            employer, date and number, and your real language levels.
          </p>
          <button
            type="button"
            className={BUTTON}
            disabled={prompt.isFetching}
            onClick={() => {
              void copyPrompt();
            }}
          >
            {prompt.isFetching
              ? 'Getting the prompt…'
              : 'Copy translation prompt and open Claude ↗'}
          </button>
          {copied && (
            <p role="status" className="text-slate-600">
              {copied === 'yes'
                ? 'Copied. Paste it into Claude, then paste Claude’s answer below.'
                : 'Could not copy. Select the prompt below instead.'}
            </p>
          )}
          {prompt.isError && (
            <p role="alert" className="text-red-700">
              {getErrorMessage(prompt.error)}
            </p>
          )}
          {prompt.data && (
            <details open={copied === 'failed'}>
              <summary className="cursor-pointer text-xs text-slate-500">Show the prompt</summary>
              <textarea
                readOnly
                value={prompt.data}
                aria-label="Translation prompt"
                rows={6}
                className={`${inputClass} mt-1 font-mono text-xs`}
              />
            </details>
          )}
        </li>
        <li className="space-y-2">
          <label htmlFor={boxId} className="block">
            Paste your {name} resume
          </label>
          <textarea
            id={boxId}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            rows={8}
            className={`${inputClass} font-mono`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={PRIMARY}
              disabled={save.isPending || !text.trim()}
              onClick={() => {
                save.mutate(
                  { language, text },
                  {
                    onSuccess: () => {
                      setText('');
                      setCopied(null);
                    },
                  },
                );
              }}
            >
              {save.isPending ? 'Saving…' : `Save ${name} resume`}
            </button>
            <span className="text-slate-500">or</span>
            <UploadButton language={language} />
          </div>
          {save.isError && (
            <p role="alert" className="text-red-700">
              {getErrorMessage(save.error)}
            </p>
          )}
        </li>
      </ol>
    </div>
  );
}

/**
 * Your master resume in other languages. A job whose ad is in one of them is checked against
 * that resume (so German keywords are found in a German resume), and its Claude prompt starts
 * from it. Resume-Matcher keeps using the main master resume.
 */
export function OtherResumes({ profile }: { profile: Profile }) {
  const taken = new Set([profile.resumeLanguage, ...profile.otherResumes.map((r) => r.language)]);
  const free = Object.keys(RESUME_LANGUAGES).filter((code) => !taken.has(code));

  return (
    <section
      aria-labelledby="other-resumes-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <div>
        <h2 id="other-resumes-heading" className="text-lg font-semibold text-slate-900">
          Resume in other languages
        </h2>
        <p className="text-sm text-slate-600">
          Optional. Jobs whose ad is in one of these languages are checked against that resume, and
          the Claude prompt starts from it. Your master resume above stays the main one.
        </p>
      </div>
      {profile.otherResumes.map((resume) => (
        // key includes the save time, so the text box starts again from a newly saved version.
        <SavedResume key={`${resume.language}-${resume.updatedAt}`} resume={resume} />
      ))}
      {free.length > 0 &&
        (profile.otherResumes.length === 0 ? (
          <AddResume key={free.join()} languages={free} />
        ) : (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-indigo-700">
              Add another language
            </summary>
            <div className="mt-3">
              <AddResume key={free.join()} languages={free} />
            </div>
          </details>
        ))}
    </section>
  );
}
