import type { SavedAnswer } from '@jobsearch/data';
import { useDeleteSavedAnswer, useSaveAnswer, useSavedAnswers } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { inputClass } from './Field';

/** One saved answer: its question, the answer, and Edit / Delete. */
function SavedAnswerRow({ item }: { item: SavedAnswer }) {
  const t = useTranslations('Profile.claudeAnswers');
  const errorText = useErrorText();
  const save = useSaveAnswer();
  const remove = useDeleteSavedAnswer();
  const [draft, setDraft] = useState<string | null>(null);
  const error = save.error ?? remove.error;

  const commit = () => {
    if (draft === null) return;
    const answer = draft.trim();
    setDraft(null);
    if (answer && answer !== item.answer) save.mutate({ question: item.question, answer });
  };

  return (
    <li className="space-y-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <p className="text-slate-500">{item.question}</p>
      {draft === null ? (
        <p className="flex flex-wrap items-center gap-x-3 text-slate-900">
          <span className="min-w-0 flex-1">{item.answer}</span>
          <button
            type="button"
            onClick={() => {
              setDraft(item.answer);
            }}
            aria-label={t('editFor', { question: item.question })}
            className="text-brand-600 hover:text-brand-800"
          >
            {t('edit')}
          </button>
          <button
            type="button"
            onClick={() => {
              remove.mutate(item.id);
            }}
            aria-label={t('deleteFor', { question: item.question })}
            className="text-red-700 hover:text-red-900"
          >
            {t('delete')}
          </button>
        </p>
      ) : (
        <span className="flex gap-2">
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by clicking Edit
            autoFocus
            value={draft}
            aria-label={t('answerFor', { question: item.question })}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') setDraft(null);
            }}
            className={inputClass}
          />
          <button
            type="button"
            onClick={commit}
            className="rounded-md bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t('save')}
          </button>
        </span>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {errorText(error)}
        </p>
      )}
    </li>
  );
}

/** Your answers to Claude's questions, kept for the next jobs. Edit or delete any. */
export function SavedAnswers() {
  const t = useTranslations('Profile.claudeAnswers');
  const errorText = useErrorText();
  const answers = useSavedAnswers();

  if (answers.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(answers.error)}
      </p>
    );
  }
  if (!answers.data || answers.data.length === 0) {
    return <p className="text-sm text-slate-500">{answers.isPending ? t('loading') : t('none')}</p>;
  }
  return (
    <ul aria-label={t('listLabel')} className="space-y-2">
      {answers.data.map((item) => (
        <SavedAnswerRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
