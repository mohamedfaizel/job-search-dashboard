import type { LanguageResume, Profile } from '@jobsearch/data';
import {
  RESUME_LANGUAGES,
  useDeleteLanguageResume,
  useSaveLanguageResume,
  useTranslationPrompt,
  useUploadLanguageResume,
} from '@jobsearch/data';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { AutoHide } from '../../../components/AutoHide';
import { useErrorText } from '../../../i18n/useErrorText';
import { inputClass } from './Field';
import { useLanguageName } from './useLanguageName';

const CLAUDE_URL = 'https://claude.ai/new';
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.docx';
const BUTTON =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const PRIMARY =
  'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50';

const SELECT = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm';

/** "Upload a PDF or Word file" for one language. */
function UploadButton({
  language,
  label,
  onDone,
}: {
  language: string;
  label?: string;
  onDone?: () => void;
}) {
  const errorText = useErrorText();
  const t = useTranslations('Profile.other');
  const nameOf = useLanguageName();
  const upload = useUploadLanguageResume();
  const id = useId();
  const [tooBig, setTooBig] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label
        htmlFor={id}
        className={`${BUTTON} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500`}
      >
        {upload.isPending ? t('reading') : (label ?? t('upload'))}
        <input
          id={id}
          type="file"
          accept={ACCEPT}
          aria-label={t('uploadLabel', { language: nameOf(language) })}
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
          {tooBig ? t('tooBig') : errorText(upload.error)}
        </span>
      )}
    </span>
  );
}

/** Called after a resume is saved, so the page can say so even though the form starts again. */
type OnSaved = (language: string) => void;

/** One saved resume in another language: edit the text, replace it with a file, or delete it. */
function SavedResume({
  resume,
  justSaved,
  onSaved,
}: {
  resume: LanguageResume;
  justSaved: boolean;
  onSaved: OnSaved;
}) {
  const errorText = useErrorText();
  const t = useTranslations('Profile.other');
  const format = useFormatter();
  const save = useSaveLanguageResume();
  const remove = useDeleteLanguageResume();
  const [text, setText] = useState(resume.text);
  const name = useLanguageName()(resume.language);
  const boxId = useId();

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-slate-900">{name}</h3>
        <span className="text-xs text-slate-500">
          {resume.fileName ?? t('pasted')} ·{' '}
          {t('savedOn', {
            date: format.dateTime(new Date(resume.updatedAt), { dateStyle: 'medium' }),
          })}
        </span>
      </div>
      <label htmlFor={boxId} className="sr-only">
        {t('textLabel', { language: name })}
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
      {justSaved && text === resume.text && (
        <AutoHide key={resume.text}>
          <p role="status" className="text-sm text-emerald-700">
            {resume.fileName
              ? t('savedNoteFile', { language: name, file: resume.fileName })
              : t('savedNote', { language: name })}
          </p>
        </AutoHide>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {/* Only when there is something to save: a grey button next to a saved resume looks broken. */}
        {text !== resume.text && (
          <button
            type="button"
            className={PRIMARY}
            disabled={save.isPending || !text.trim()}
            onClick={() => {
              save.mutate(
                { language: resume.language, text },
                {
                  onSuccess: () => {
                    onSaved(resume.language);
                  },
                },
              );
            }}
          >
            {save.isPending ? t('saving') : t('saveChanges')}
          </button>
        )}
        <UploadButton
          language={resume.language}
          label={t('replace')}
          onDone={() => {
            onSaved(resume.language);
          }}
        />
        <button
          type="button"
          className="text-sm text-red-700 hover:underline disabled:opacity-50"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(resume.language);
          }}
        >
          {t('delete')}
        </button>
      </div>
      {(save.error ?? remove.error) && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(save.error ?? remove.error)}
        </p>
      )}
    </div>
  );
}

/**
 * Adds your resume in one more language: translate the master resume with Claude (one prompt,
 * facts and language levels kept), then paste the answer or upload a file you already have.
 */
function AddResume({ languages, onSaved }: { languages: string[]; onSaved: OnSaved }) {
  const errorText = useErrorText();
  const [language, setLanguage] = useState(languages.includes('de') ? 'de' : (languages[0] ?? ''));
  const [text, setText] = useState('');
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const t = useTranslations('Profile.other');
  const nameOf = useLanguageName();
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
          {t('addIn')}
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
          <p>{t('noResume', { language: name })}</p>
          <button
            type="button"
            className={BUTTON}
            disabled={prompt.isFetching}
            onClick={() => {
              void copyPrompt();
            }}
          >
            {prompt.isFetching ? t('gettingPrompt') : t('copyPrompt')}
          </button>
          {copied && (
            <p role="status" className="text-slate-600">
              {copied === 'yes' ? t('copied') : t('copyFailed')}
            </p>
          )}
          {prompt.isError && (
            <p role="alert" className="text-red-700">
              {errorText(prompt.error)}
            </p>
          )}
          {prompt.data && (
            <details open={copied === 'failed'}>
              <summary className="cursor-pointer text-xs text-slate-500">{t('showPrompt')}</summary>
              <textarea
                readOnly
                value={prompt.data}
                aria-label={t('promptLabel')}
                rows={6}
                className={`${inputClass} mt-1 font-mono text-xs`}
              />
            </details>
          )}
        </li>
        <li className="space-y-2">
          <label htmlFor={boxId} className="block">
            {t('paste', { language: name })}
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
                      onSaved(language);
                    },
                  },
                );
              }}
            >
              {save.isPending ? t('saving') : t('saveResume', { language: name })}
            </button>
            <span className="text-slate-500">{t('or')}</span>
            <UploadButton
              language={language}
              onDone={() => {
                onSaved(language);
              }}
            />
          </div>
          <p className="text-xs text-slate-500">{t('uploadSaves')}</p>
          {save.isError && (
            <p role="alert" className="text-red-700">
              {errorText(save.error)}
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
  const t = useTranslations('Profile.other');
  // The language saved last, to confirm it: the saved resume's form starts again after a save.
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const taken = new Set([profile.resumeLanguage, ...profile.otherResumes.map((r) => r.language)]);
  const free = Object.keys(RESUME_LANGUAGES).filter((code) => !taken.has(code));

  return (
    <section
      aria-labelledby="other-resumes-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <div>
        <h2 id="other-resumes-heading" className="text-lg font-semibold text-slate-900">
          {t('heading')}
        </h2>
        <p className="text-sm text-slate-600">{t('intro')}</p>
      </div>
      {profile.otherResumes.map((resume) => (
        // key includes the save time, so the text box starts again from a newly saved version.
        <SavedResume
          key={`${resume.language}-${resume.updatedAt}`}
          resume={resume}
          justSaved={justSaved === resume.language}
          onSaved={setJustSaved}
        />
      ))}
      {free.length > 0 &&
        (profile.otherResumes.length === 0 ? (
          <AddResume key={free.join()} languages={free} onSaved={setJustSaved} />
        ) : (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-700">
              {t('addAnother')}
            </summary>
            <div className="mt-3">
              <AddResume key={free.join()} languages={free} onSaved={setJustSaved} />
            </div>
          </details>
        ))}
    </section>
  );
}
