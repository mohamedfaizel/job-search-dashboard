import {
  useMyProfile,
  useSaveAnswer,
  useSaveClaudeAnswers,
  useSavedAnswers,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import type { NoteAnswers, NoteEntry } from '../claudeAnswers';
import {
  effectiveAnswer,
  followUpPrompt,
  parseAnswers,
  progress,
  stretchLine,
} from '../claudeAnswers';
import { checkSections } from '../reply';
import { CopyText } from './CopyText';

/** Sections Claude asks you about: shown open, as a short to-do list. */
const STRETCHES = /stretch|dehn/i;
const QUESTIONS = /ask me|frag/i;

const BUTTON = 'h-8 rounded-lg border px-3 text-sm font-medium';
const INPUT =
  'h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900';

/**
 * Claude's CHECK part of the reply, as things to answer here: for each stretch (a line you may
 * struggle to explain in an interview) Keep, Soften with your own words, or Drop; for each
 * question a box for your answer. Every answer is kept in one place (Profile > Applications) and
 * fills in the same question on the next jobs: a question answered before is folded away, so only
 * new ones show. Your choices are kept on the job. "Copy my answers for Claude" makes the message to paste in
 * the same chat. Where Claude placed your keywords and what it skipped or changed are folded
 * away below.
 */
export function ClaudeNotes({
  jobId,
  text,
  resume,
  answers: saved,
}: {
  jobId: string;
  text: string;
  /** The resume saved for this job: Soften starts from the line a stretch is about. */
  resume: string;
  /** Your decisions saved for this job (JSON text). */
  answers: string;
}) {
  const t = useTranslations('Jobs.claudeNotes');
  const errorText = useErrorText();
  const profile = useMyProfile();
  const bank = useSavedAnswers();
  const keep = useSaveClaudeAnswers();
  const remember = useSaveAnswer();
  const [answers, setAnswers] = useState<NoteAnswers>(() => parseAnswers(saved));
  const [softening, setSoftening] = useState<string | null>(null);
  /** Questions that already had an answer when this opened: folded away, not asked again. */
  const [known, setKnown] = useState<ReadonlySet<string> | null>(null);

  const sections = checkSections(text);
  const showStretches = profile.data?.showStretches ?? true;
  const fill = profile.data?.fillSavedAnswers ?? true;
  const savedBank = bank.data ?? [];
  const questions = sections.filter((s) => QUESTIONS.test(s.label)).flatMap((s) => s.items);
  // Decided once your saved answers are in, so a box does not vanish while you type in it.
  if (known === null && (bank.data || bank.isError) && (profile.data || profile.isError)) {
    setKnown(
      new Set(
        questions.filter((q) => effectiveAnswer(q, answers[q], savedBank, fill).answer.trim()),
      ),
    );
  }
  if (sections.length === 0) return null;

  const stretches = showStretches
    ? sections.filter((s) => STRETCHES.test(s.label)).flatMap((s) => s.items)
    : [];
  const answeredBefore = questions.filter((q) => known?.has(q));
  const open = questions.filter((q) => !known?.has(q));
  const rest = sections.filter((s) => !STRETCHES.test(s.label) && !QUESTIONS.test(s.label));
  const hidden = !showStretches ? sections.filter((s) => STRETCHES.test(s.label)) : [];
  const count = stretches.length + open.length;
  const { answered, filled } = progress({ stretches, questions }, answers, savedBank, fill);

  /** Changes one item and keeps all decisions on the job. */
  const change = (item: string, patch: NoteEntry) => {
    const next = { ...answers, [item]: { ...answers[item], ...patch } };
    setAnswers(next);
    keep.mutate({ jobId, answers: JSON.stringify(next) });
  };
  const choose = (item: string, choice: NoteEntry['choice']) => {
    setSoftening(choice === 'soften' ? item : null);
    change(item, {
      choice,
      ...(choice === 'soften' ? { text: answers[item]?.text ?? stretchLine(item, resume) } : {}),
    });
  };
  /** Saves an answer on the job and in your saved answers, for the next jobs. */
  const answer = (question: string, value: string) => {
    change(question, { answer: value });
    if (value.trim()) remember.mutate({ question, answer: value });
  };
  const error = keep.error ?? remember.error;

  const questionRow = (question: string) => {
    const entry = answers[question];
    const current = effectiveAnswer(question, entry, savedBank, fill);
    return (
      <li
        key={question}
        className="space-y-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2.5"
      >
        <label className="block space-y-1.5 text-sm text-slate-800">
          {question}
          <input
            value={current.answer}
            placeholder={t('answerPlaceholder')}
            aria-label={t('answerFor', { question })}
            onChange={(e) => {
              setAnswers({ ...answers, [question]: { ...entry, answer: e.target.value } });
            }}
            onBlur={(e) => {
              // Leaving a filled-in saved answer as it is still counts as answering.
              if (current.saved && e.target.value === current.answer) {
                change(question, { answer: e.target.value });
              } else answer(question, e.target.value);
            }}
            className={INPUT}
          />
        </label>
        {current.saved && (
          <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-800">
            {t('fromSaved')}
          </span>
        )}
      </li>
    );
  };

  return (
    <section
      aria-label={t('title')}
      className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="text-sm font-semibold text-amber-950">
          {count > 0 ? t('titleCount', { count }) : t('title')}
        </h3>
        {count > 0 && (
          <span className="text-xs text-amber-900">{t('progress', { answered, filled })}</span>
        )}
      </div>

      {stretches.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
            {t('stretches')}
          </h4>
          <ul aria-label={t('stretchesList')} className="space-y-2">
            {stretches.map((item) => {
              const entry = answers[item];
              const choice = entry?.choice;
              return (
                <li
                  key={item}
                  className="space-y-2 rounded-lg border border-amber-200 bg-white px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="min-w-0 flex-1 text-sm text-slate-800">{item}</p>
                    {choice && softening !== item ? (
                      <span className="flex items-center gap-2 text-sm">
                        <span
                          className={`rounded-lg px-2.5 py-1 ${choice === 'drop' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}
                        >
                          {t(`done.${choice}`)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (choice === 'soften') setSoftening(item);
                            else change(item, { choice: undefined });
                          }}
                          aria-label={t('changeFor', { item })}
                          className="text-brand-600 hover:text-brand-800"
                        >
                          {t('change')}
                        </button>
                      </span>
                    ) : (
                      <span role="group" aria-label={item} className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            choose(item, 'keep');
                          }}
                          className={`${BUTTON} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
                        >
                          {t('keep')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            choose(item, 'soften');
                          }}
                          className={`${BUTTON} ${softening === item ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                        >
                          {t('soften')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            choose(item, 'drop');
                          }}
                          className={`${BUTTON} border-red-200 bg-red-50 text-red-800 hover:bg-red-100`}
                        >
                          {t('drop')}
                        </button>
                      </span>
                    )}
                  </div>
                  {softening === item && (
                    <label className="block space-y-1 text-xs text-slate-600">
                      {t('howRead')}
                      <input
                        // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by clicking Soften
                        autoFocus
                        value={entry?.text ?? ''}
                        placeholder={t('howReadHint')}
                        onChange={(e) => {
                          setAnswers({ ...answers, [item]: { ...entry, text: e.target.value } });
                        }}
                        onBlur={(e) => {
                          change(item, { choice: 'soften', text: e.target.value });
                          setSoftening(null);
                        }}
                        className={INPUT}
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
            {t('questions')}
          </h4>
          <ul aria-label={t('questionsList')} className="space-y-2">
            {open.map(questionRow)}
          </ul>
          <p className="text-xs text-slate-600">{t('keptHint')}</p>
        </div>
      )}

      {answeredBefore.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-emerald-800">
            {t('answeredBefore', { count: answeredBefore.length })}
          </summary>
          <ul aria-label={t('answeredBeforeList')} className="mt-2 space-y-2">
            {answeredBefore.map(questionRow)}
          </ul>
        </details>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {t('saveError', { error: errorText(error) })}
        </p>
      )}

      {answered > 0 && (
        <CopyText
          primary
          label={t('copy')}
          text={followUpPrompt({ stretches, questions }, answers, savedBank, fill)}
          copiedHint={t('copiedHint')}
          boxLabel={t('copyBox')}
        />
      )}

      {rest.length + hidden.length > 0 && (
        <details className="text-xs text-slate-700">
          <summary className="cursor-pointer text-amber-900">{t('more')}</summary>
          <div className="mt-1.5 space-y-1.5">
            {[...rest, ...hidden].map((section) => (
              <div key={section.label}>
                <span className="font-semibold">{section.label}: </span>
                {section.items.join(' · ')}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
