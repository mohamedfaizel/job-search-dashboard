import type { LetterSuggestion } from '@jobsearch/data';
import {
  useCoverLetterTemplate,
  useImproveLetter,
  useImproveLetterPrompt,
  useJobCoverLetter,
  useSaveCoverLetterTemplate,
  useSaveJobCoverLetter,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { move, removeAt, replaceAt } from '../docOps';
import { DownIcon, TrashIcon, UpIcon } from './icons';
import { ImproveFlow } from './ImproveFlow';
import { FIELD, ICON_BUTTON, SMALL_BUTTON } from './ui';

interface Props {
  jobId: string;
  /** Called after each save, so the preview makes the PDF again. */
  onSaved: () => void;
}

/** Wait this long after the last keystroke before saving. */
const AUTOSAVE_MS = 1000;

const toParagraphs = (text: string) => (text.trim() ? text.split(/\n\s*\n/) : []);
const toText = (paragraphs: string[]) =>
  paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n');
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Your template with this job's details: {company} and {job} become the company and title. */
export const fillTemplate = (text: string, job: { company: string; title: string }) =>
  text.replace(/\{company\}/gi, job.company).replace(/\{job\}/gi, job.title);

/** Loads the letter, then hands it to the editor, which keeps its own copy while you type. */
export function LetterPanel({ jobId, onSaved }: Props) {
  const t = useTranslations('Resume.letter');
  const errorText = useErrorText();
  const letter = useJobCoverLetter(jobId);
  const save = useSaveJobCoverLetter();
  const template = useCoverLetterTemplate(letter.data?.language ?? '', !!letter.data);
  if (letter.isPending) return <p className="text-sm text-slate-500">{t('loading')}</p>;
  if (letter.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(letter.error)}
      </p>
    );
  }
  const start = template.data?.text ?? '';
  return (
    <LetterEditor
      initial={letter.data.text}
      title={t('title')}
      hint={t('hint')}
      emptyText={t('empty')}
      aiJobId={jobId}
      saving={save.isPending}
      saveError={save.error}
      save={(text, done) => {
        save.mutate(
          { jobId, text },
          {
            onSuccess: (saved) => {
              done(saved.text);
            },
          },
        );
      }}
      onSaved={onSaved}
      empty={(fill) =>
        start ? (
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              fill(fillTemplate(start, letter.data));
            }}
          >
            {t('fromTemplate')}
          </button>
        ) : null
      }
    />
  );
}

/**
 * Your cover letter template in one language: written once, it starts each job's letter.
 * {company} and {job} in it become the job's company and title.
 */
export function TemplatePanel({ language, onSaved }: { language: string; onSaved: () => void }) {
  const t = useTranslations('Resume.letter');
  const errorText = useErrorText();
  const template = useCoverLetterTemplate(language);
  const save = useSaveCoverLetterTemplate();
  if (template.isPending) return <p className="text-sm text-slate-500">{t('loading')}</p>;
  if (template.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(template.error)}
      </p>
    );
  }
  return (
    <LetterEditor
      initial={template.data.text}
      title={t('templateTitle')}
      hint={t('templateHint')}
      emptyText={t('templateEmpty')}
      saving={save.isPending}
      saveError={save.error}
      save={(text, done) => {
        save.mutate(
          { language, text },
          {
            onSuccess: (saved) => {
              done(saved.text);
            },
          },
        );
      }}
      onSaved={onSaved}
    />
  );
}

interface EditorProps {
  initial: string;
  title: string;
  hint: string;
  /** Shown while there is no paragraph yet. */
  emptyText: string;
  /** Saves the text and calls `done` with the text as saved. */
  save: (text: string, done: (saved: string) => void) => void;
  saving: boolean;
  saveError: Error | null;
  /** Called after each save, so the preview makes the PDF again. */
  onSaved: () => void;
  /** A job letter can be written or improved with AI; a template can't (there is no job). */
  aiJobId?: string;
  /** Shown while the letter is empty, with a way to fill it. */
  empty?: (fill: (text: string) => void) => ReactNode;
}

/**
 * This job's cover letter, paragraph by paragraph, saved on its own, with the PDF beside it. It
 * starts with the greeting and ends with the sign-off and your name: the template adds your
 * address, the date, the company and the subject line. "Write with AI" works like Improve on
 * a section: you see the new letter first and keep or discard it.
 */
function LetterEditor({
  initial,
  title,
  hint,
  emptyText,
  save,
  saving,
  saveError,
  onSaved,
  aiJobId,
  empty: emptyExtra,
}: EditorProps) {
  const t = useTranslations('Resume.letter');
  const errorText = useErrorText();
  const promptFor = useImproveLetterPrompt();
  const improve = useImproveLetter();
  const [list, setList] = useState(() => toParagraphs(initial));
  const [saved, setSaved] = useState(initial);
  const [asking, setAsking] = useState(false);

  const text = toText(list);
  const unsaved = text !== saved;
  useEffect(() => {
    if (!unsaved) return;
    const timer = setTimeout(() => {
      save(text, (done) => {
        setSaved(done);
        onSaved();
      });
    }, AUTOSAVE_MS);
    return () => {
      clearTimeout(timer);
    };
    // `save` is a new function on every render; the text is what decides a save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsaved, text, onSaved]);

  const count = words(text);
  const empty = list.length === 0;
  const input = (instruction: string) => ({
    jobId: aiJobId ?? '',
    instruction: instruction || null,
  });
  const keep = (value: string) => {
    setList(toParagraphs(value));
  };

  return (
    <section
      aria-label={title}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-semibold text-slate-900">{title}</h2>
        <span role="status" className="text-xs text-slate-500">
          {saving ? t('saving') : unsaved ? t('notSaved') : `✓ ${t('saved')}`}
        </span>
        <span className="text-xs tabular-nums text-slate-600">{t('words', { count })}</span>
        {aiJobId && (
          <button
            type="button"
            className={`${SMALL_BUTTON} inline-flex items-center gap-1`}
            aria-expanded={asking}
            onClick={() => {
              setAsking((open) => !open);
            }}
          >
            <span className="font-bold text-amber-600" aria-hidden>
              ✦
            </span>
            {empty ? t('write') : t('improve')}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">{hint}</p>

      {asking && (
        <ImproveFlow<string>
          title={empty ? t('writeTitle') : t('improveTitle')}
          hint={t('aiHint')}
          getPrompt={(instruction) => promptFor.mutateAsync(input(instruction))}
          run={async (instruction, reply) => {
            const out: LetterSuggestion = await improve.mutateAsync({
              ...input(instruction),
              reply,
            });
            return { ...out, value: out.after };
          }}
          onKeep={keep}
          onClose={() => {
            setAsking(false);
          }}
        />
      )}

      {empty && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate-600">{emptyText}</p>
          {emptyExtra?.(keep)}
        </div>
      )}
      <ul className="space-y-2">
        {list.map((paragraph, index) => (
          // A paragraph has no id of its own, so its place is its identity.
          <li key={index} className="flex items-start gap-1">
            <textarea
              value={paragraph}
              rows={3}
              aria-label={t('paragraph', { n: index + 1 })}
              onChange={(event) => {
                setList(replaceAt(list, index, event.target.value));
              }}
              className={`${FIELD} min-w-0 flex-1`}
            />
            <div className="flex flex-col">
              <button
                type="button"
                className={ICON_BUTTON}
                disabled={index === 0}
                aria-label={t('up', { n: index + 1 })}
                title={t('upShort')}
                onClick={() => {
                  setList(move(list, index, index - 1));
                }}
              >
                <UpIcon />
              </button>
              <button
                type="button"
                className={ICON_BUTTON}
                disabled={index === list.length - 1}
                aria-label={t('down', { n: index + 1 })}
                title={t('downShort')}
                onClick={() => {
                  setList(move(list, index, index + 1));
                }}
              >
                <DownIcon />
              </button>
              <button
                type="button"
                className={`${ICON_BUTTON} hover:bg-red-50 hover:text-red-700`}
                aria-label={t('remove', { n: index + 1 })}
                title={t('removeShort')}
                onClick={() => {
                  setList(removeAt(list, index));
                }}
              >
                <TrashIcon />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={SMALL_BUTTON}
        onClick={() => {
          setList([...list, '']);
        }}
      >
        + {t('add')}
      </button>
      {saveError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(saveError)}
        </p>
      )}
    </section>
  );
}
