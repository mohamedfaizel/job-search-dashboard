import type { LetterSuggestion } from '@jobsearch/data';
import {
  useImproveLetter,
  useImproveLetterPrompt,
  useJobCoverLetter,
  useSaveJobCoverLetter,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
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

/** Loads the letter, then hands it to the editor, which keeps its own copy while you type. */
export function LetterPanel({ jobId, onSaved }: Props) {
  const t = useTranslations('Resume.letter');
  const errorText = useErrorText();
  const letter = useJobCoverLetter(jobId);
  if (letter.isPending) return <p className="text-sm text-slate-500">{t('loading')}</p>;
  if (letter.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(letter.error)}
      </p>
    );
  }
  return <LetterEditor jobId={jobId} initial={letter.data.text} onSaved={onSaved} />;
}

/**
 * This job's cover letter, paragraph by paragraph, saved on its own, with the PDF beside it. It
 * starts with the greeting and ends with the sign-off and your name: the template adds your
 * address, the date, the company and the subject line. "Write with AI" works like Improve on
 * a section: you see the new letter first and keep or discard it.
 */
function LetterEditor({ jobId, initial, onSaved }: Props & { initial: string }) {
  const t = useTranslations('Resume.letter');
  const errorText = useErrorText();
  const save = useSaveJobCoverLetter();
  const promptFor = useImproveLetterPrompt();
  const improve = useImproveLetter();
  const [list, setList] = useState(() => toParagraphs(initial));
  const [saved, setSaved] = useState(initial);
  const [asking, setAsking] = useState(false);

  const text = toText(list);
  const unsaved = text !== saved;
  const { mutate } = save;
  useEffect(() => {
    if (!unsaved) return;
    const timer = setTimeout(() => {
      mutate(
        { jobId, text },
        {
          onSuccess: (done) => {
            setSaved(done.text);
            onSaved();
          },
        },
      );
    }, AUTOSAVE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [unsaved, text, jobId, mutate, onSaved]);

  const count = words(text);
  const empty = list.length === 0;
  const input = (instruction: string) => ({ jobId, instruction: instruction || null });
  const keep = (value: string) => {
    setList(toParagraphs(value));
  };

  return (
    <section
      aria-label={t('title')}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-semibold text-slate-900">{t('title')}</h2>
        <span role="status" className="text-xs text-slate-500">
          {save.isPending ? t('saving') : unsaved ? t('notSaved') : `✓ ${t('saved')}`}
        </span>
        <span className="text-xs tabular-nums text-slate-600">{t('words', { count })}</span>
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
      </div>
      <p className="text-xs text-slate-500">{t('hint')}</p>

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

      {empty && <p className="text-sm text-slate-600">{t('empty')}</p>}
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
      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(save.error)}
        </p>
      )}
    </section>
  );
}
