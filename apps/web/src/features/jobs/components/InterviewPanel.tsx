import {
  useDeleteInterviewPrep,
  useJobInsights,
  useSaveInterviewPrep,
  useSetInterviewDate,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useAiChat } from '../../../lib/ai-chat';
import { useJobFormat } from '../useJobFormat';
import { AiTag } from './AiLabels';
import { CopyText } from './CopyText';
import type { GapFocus } from './InterviewPrepView';
import { InterviewPrepView } from './InterviewPrepView';
import { BUTTON, PRIMARY } from './JobResumePanel';

const LINK = 'text-brand-700 hover:underline';

/**
 * The interview tab. Claude writes the preparation (so it uses your Claude subscription, like the
 * Apply kit): copy the prompt, paste the reply back, and read it here later. Above that, the
 * skills the ad asks for and your resume doesn't show, which are the likely hard questions. That
 * part needs no AI.
 */
export function InterviewPanel({ jobId }: { jobId: string }) {
  const insights = useJobInsights(jobId);
  const save = useSaveInterviewPrep();
  const remove = useDeleteInterviewPrep();
  const errorText = useErrorText();
  const f = useJobFormat();
  const t = useTranslations('Jobs.interview');
  const chat = useAiChat();
  const [text, setText] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [clipboardBlocked, setClipboardBlocked] = useState(false);
  // The paste box only shows when you ask for it (or the clipboard is blocked).
  const [boxOpen, setBoxOpen] = useState(false);
  const [focus, setFocus] = useState<GapFocus | null>(null);
  const [mockLanguage, setMockLanguage] = useState<'en' | 'de' | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (boxOpen) box.current?.focus();
  }, [boxOpen]);

  if (insights.isPending) return <p className="text-sm text-slate-500">{t('loading')}</p>;
  if (insights.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t('loadError', { error: errorText(insights.error) })}
      </p>
    );
  }

  const data = insights.data;
  const prep = data.interviewPrep;
  const gaps = data.skills.filter((s) => !s.inResume && !s.youHave).map((s) => s.term);
  const level = f.germanLevel(data);

  const saveText = (value: string) => {
    save.mutate(
      { jobId, text: value },
      {
        onSuccess: () => {
          setText('');
          setReplacing(false);
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
    setBoxOpen(true);
  };

  const showInput = !prep || replacing;
  const error = save.error ?? remove.error;

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
        {t('intro')}
      </p>

      <InterviewDate jobId={jobId} at={data.interviewAt} />

      <section aria-label={t('gapsTitle')} className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">{t('gapsTitle')}</h3>
        {gaps.length === 0 ? (
          <p className="text-sm text-slate-600">{data.hasResume ? t('noGaps') : t('noResume')}</p>
        ) : (
          <>
            <ul aria-label={t('gapsTitle')} className="flex flex-wrap gap-1.5">
              {gaps.map((term) => (
                <li key={term}>
                  {prep ? (
                    <button
                      type="button"
                      title={t('gapJumpHint')}
                      onClick={() => {
                        setFocus({ term, at: Date.now() });
                        savedRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                      }}
                      className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200 ring-inset hover:bg-amber-100"
                    >
                      {term} ›
                    </button>
                  ) : (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200 ring-inset">
                      {term}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">{prep ? t('gapsHintSaved') : t('gapsHint')}</p>
          </>
        )}
        {data.germanRequired && (
          <p className="text-sm text-amber-800">
            {level ? t('german', { level }) : t('germanAny')}
          </p>
        )}
      </section>

      {prep && (
        <section ref={savedRef} aria-label={t('savedTitle')} className="scroll-mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{t('savedTitle')}</h3>
          <div role="region" aria-label={t('savedBox')}>
            <InterviewPrepView jobId={jobId} text={prep.text} focus={focus} />
          </div>
          <p className="text-xs text-slate-500">
            {t('savedAt', { date: f.date(prep.updatedAt) })} ·{' '}
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
        </section>
      )}

      {showInput && (
        <section aria-label={t('askTitle')} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">{t('askTitle')}</h3>
          <CopyText
            label={t('copy')}
            text={data.interviewPrompt}
            copiedHint={t('copiedHint')}
            boxLabel={t('promptBox')}
            openUrl={chat.url}
            icon={<AiTag kind="chat" />}
            primary
          >
            <span className="text-sm text-slate-600">{t('copyHint')}</span>
          </CopyText>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                className={PRIMARY}
                disabled={save.isPending}
                onClick={() => {
                  void pasteFromClipboard();
                }}
              >
                {save.isPending ? t('saving') : t('paste')}
              </button>
              {!boxOpen && (
                <button
                  type="button"
                  className={LINK + ' text-sm'}
                  onClick={() => {
                    setBoxOpen(true);
                  }}
                >
                  {t('pasteInBox')}
                </button>
              )}
            </div>
            {clipboardBlocked && <p className="text-xs text-slate-500">{t('blocked')}</p>}
            <form
              hidden={!boxOpen}
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveText(text);
              }}
            >
              <textarea
                ref={box}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                }}
                aria-label={t('boxLabel')}
                placeholder={t('placeholder')}
                rows={6}
                className="w-full rounded-xl border-[1.5px] border-slate-300 bg-white p-3 text-sm"
              />
              <button type="submit" disabled={save.isPending || !text.trim()} className={BUTTON}>
                {save.isPending ? t('saving') : t('save')}
              </button>
            </form>
          </div>
        </section>
      )}

      <section aria-label={t('mock.title')} className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">{t('mock.title')}</h3>
        <p className="text-sm text-slate-600">{t('mock.intro')}</p>
        {data.germanRequired && (
          <div
            role="radiogroup"
            aria-label={t('mock.language')}
            className="inline-flex rounded-md ring-1 ring-slate-200"
          >
            {(['de', 'en'] as const).map((lang) => {
              const on = (mockLanguage ?? 'de') === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setMockLanguage(lang);
                  }}
                  className={`px-3 py-1 text-xs font-medium first:rounded-l-md last:rounded-r-md ${
                    on ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t(`mock.${lang}`)}
                </button>
              );
            })}
          </div>
        )}
        <CopyText
          label={t('mock.copy')}
          text={
            data.germanRequired && (mockLanguage ?? 'de') === 'de'
              ? data.mockInterviewPromptDe
              : data.mockInterviewPrompt
          }
          copiedHint={t('mock.copiedHint')}
          boxLabel={t('mock.promptBox')}
          openUrl={chat.url}
          icon={<AiTag kind="chat" />}
        />
      </section>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t('error', { error: errorText(error) })}
        </p>
      )}
    </div>
  );
}

/** The ISO time as the value of a datetime-local box, in your time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * When the interview is. Saving it moves the job to Interviewing, and the bell reminds you a day
 * before.
 */
function InterviewDate({ jobId, at }: { jobId: string; at: string | null }) {
  const t = useTranslations('Jobs.interview.date');
  const errorText = useErrorText();
  const f = useJobFormat();
  const set = useSetInterviewDate();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const save = (next: string | null) => {
    set.mutate(
      { jobId, at: next },
      {
        onSuccess: () => {
          setEditing(false);
        },
      },
    );
  };

  return (
    <section aria-label={t('title')} className="space-y-1.5">
      {at && !editing ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="rounded-md bg-brand-50 px-2 py-0.5 font-medium text-brand-800 ring-1 ring-brand-200 ring-inset">
            📅 {t('on', { when: f.dateTime(at) })}
          </span>
          <span className="text-xs text-slate-500">{t('reminder')}</span>
          <button
            type="button"
            className={LINK + ' text-xs'}
            onClick={() => {
              setValue(toLocalInput(at));
              setEditing(true);
            }}
          >
            {t('change')}
          </button>
          <button
            type="button"
            className="text-xs text-red-700 hover:underline disabled:opacity-50"
            disabled={set.isPending}
            onClick={() => {
              save(null);
            }}
          >
            {t('clear')}
          </button>
        </p>
      ) : editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value) save(new Date(value).toISOString());
          }}
        >
          <input
            type="datetime-local"
            aria-label={t('label')}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          />
          <button type="submit" className={BUTTON} disabled={!value || set.isPending}>
            {t('save')}
          </button>
          <button
            type="button"
            className={LINK + ' text-xs'}
            onClick={() => {
              setEditing(false);
            }}
          >
            {t('cancel')}
          </button>
          <span className="basis-full text-xs text-slate-500">{t('hint')}</span>
        </form>
      ) : (
        <button
          type="button"
          className={LINK + ' text-sm'}
          onClick={() => {
            setValue('');
            setEditing(true);
          }}
        >
          📅 {t('add')}
        </button>
      )}
      {set.error && (
        <p role="alert" className="text-sm text-red-700">
          {t('error', { error: errorText(set.error) })}
        </p>
      )}
    </section>
  );
}
