import { useDeleteInterviewPrep, useJobInsights, useSaveInterviewPrep } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useJobFormat } from '../useJobFormat';
import { CopyText } from './CopyText';
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
  const [text, setText] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [clipboardBlocked, setClipboardBlocked] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

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
    box.current?.focus();
  };

  const showInput = !prep || replacing;
  const error = save.error ?? remove.error;

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
        {t('intro')}
      </p>

      <section aria-label={t('gapsTitle')} className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">{t('gapsTitle')}</h3>
        {gaps.length === 0 ? (
          <p className="text-sm text-slate-600">{data.hasResume ? t('noGaps') : t('noResume')}</p>
        ) : (
          <>
            <ul aria-label={t('gapsTitle')} className="flex flex-wrap gap-1.5">
              {gaps.map((term) => (
                <li
                  key={term}
                  className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200 ring-inset"
                >
                  {term}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">{t('gapsHint')}</p>
          </>
        )}
        {data.germanRequired && (
          <p className="text-sm text-amber-800">
            {level ? t('german', { level }) : t('germanAny')}
          </p>
        )}
      </section>

      {prep && (
        <section aria-label={t('savedTitle')} className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{t('savedTitle')}</h3>
          <div
            role="region"
            aria-label={t('savedBox')}
            className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800"
          >
            {prep.text}
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

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t('error', { error: errorText(error) })}
        </p>
      )}
    </div>
  );
}
