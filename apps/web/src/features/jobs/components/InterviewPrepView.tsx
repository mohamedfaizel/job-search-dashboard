import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PartKey, PrepPart } from '../interviewPrep';
import { findGap, listItems, parseGaps, parseQuestions, splitPrep } from '../interviewPrep';

const PILL = 'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset';
const PILL_ON = 'bg-brand-50 text-brand-700 ring-brand-300';
const PILL_OFF = 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50';
const SMALL =
  'rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';

/** A list of texts kept in this browser, e.g. the questions you know for one job. */
function useStoredList(key: string) {
  const [list, setList] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const toggle = (item: string, on: boolean) => {
    setList((old) => {
      const next = on ? [...new Set([...old, item])] : old.filter((x) => x !== item);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage blocked: it still works until the page reloads.
      }
      return next;
    });
  };
  return [list, toggle] as const;
}

export interface GapFocus {
  term: string;
  /** Changes on every click, so clicking the same chip again jumps again. */
  at: number;
}

/**
 * Claude's saved interview prep, split into small tabs: what they want, about me, the questions
 * as flash cards, my gaps, questions to ask them and a research checklist to tick. A reply with
 * another shape is shown as plain text.
 */
export function InterviewPrepView({
  jobId,
  text,
  focus,
}: {
  jobId: string;
  text: string;
  focus: GapFocus | null;
}) {
  const t = useTranslations('Jobs.interview.prep');
  const parts = useMemo(() => splitPrep(text), [text]);
  const [tab, setTab] = useState<PartKey>('questions');
  const questions = useMemo(
    () => parseQuestions(parts.find((p) => p.key === 'questions')?.body ?? ''),
    [parts],
  );
  const [known, setKnown] = useStoredList(`interview.known.${jobId}`);
  const knownCount = questions.filter((q) => known.includes(q.question)).length;

  // A gap chip was clicked: show My gaps.
  const [shownFocus, setShownFocus] = useState(focus);
  if (focus !== shownFocus) {
    setShownFocus(focus);
    if (focus && parts.some((p) => p.key === 'gaps')) setTab('gaps');
  }

  if (parts.length === 0) {
    return (
      <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800">
        {text}
      </div>
    );
  }
  const shown = parts.find((p) => p.key === tab) ?? parts[0];
  if (!shown) return null;

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={t('tabsLabel')} className="flex flex-wrap gap-1.5">
        {parts.map((part) => (
          <button
            key={part.key}
            type="button"
            role="tab"
            aria-selected={part.key === shown.key}
            onClick={() => {
              setTab(part.key);
            }}
            className={`${PILL} ${part.key === shown.key ? PILL_ON : PILL_OFF}`}
          >
            {t(`tabs.${part.key}`)}
            {part.key === 'questions' && questions.length > 0 && (
              <span className="ml-1 tabular-nums opacity-70">
                {knownCount}/{questions.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={t(`tabs.${shown.key}`)}>
        <PartBody part={shown} jobId={jobId} focus={focus} known={known} setKnown={setKnown} />
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-slate-500">{t('wholeReply')}</summary>
        <div className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800">
          {text}
        </div>
      </details>
    </div>
  );
}

function PartBody({
  part,
  jobId,
  focus,
  known,
  setKnown,
}: {
  part: PrepPart;
  jobId: string;
  focus: GapFocus | null;
  known: string[];
  setKnown: (item: string, on: boolean) => void;
}) {
  switch (part.key) {
    case 'questions':
      return <Questions body={part.body} known={known} setKnown={setKnown} />;
    case 'gaps':
      return <Gaps body={part.body} focus={focus} />;
    case 'research':
      return <Research body={part.body} jobId={jobId} />;
    case 'care':
    case 'ask': {
      const items = listItems(part.body);
      if (items.length === 0) return <Plain text={part.body} />;
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    }
    default:
      return <Plain text={part.body} />;
  }
}

function Plain({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{text}</p>;
}

/** The questions as flash cards: the answer stays hidden until you ask for it. */
function Questions({
  body,
  known,
  setKnown,
}: {
  body: string;
  known: string[];
  setKnown: (item: string, on: boolean) => void;
}) {
  const t = useTranslations('Jobs.interview.prep');
  const questions = useMemo(() => parseQuestions(body), [body]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  if (questions.length === 0) return <Plain text={body} />;

  const at = Math.min(index, questions.length - 1);
  const q = questions[at];
  if (!q) return <Plain text={body} />;
  const isKnown = known.includes(q.question);
  const go = (to: number) => {
    setIndex(to);
    setRevealed(false);
  };

  return (
    <article
      aria-label={t('card', { n: at + 1, total: questions.length })}
      className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="tabular-nums">{t('card', { n: at + 1, total: questions.length })}</span>
        {isKnown && <span className="font-medium text-emerald-700">✓ {t('known')}</span>}
      </div>
      <p className="text-sm font-semibold text-slate-900">{q.question}</p>
      {q.why && <p className="text-xs text-slate-500">{t('why', { why: q.why })}</p>}
      {revealed ? (
        <p className="whitespace-pre-wrap rounded-r-md border-l-[3px] border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-slate-800">
          {q.answer || t('noAnswer')}
        </p>
      ) : (
        <button
          type="button"
          className={SMALL}
          onClick={() => {
            setRevealed(true);
          }}
        >
          {t('showAnswer')}
        </button>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isKnown ? (
          <button
            type="button"
            className={SMALL}
            onClick={() => {
              setKnown(q.question, false);
            }}
          >
            ↻ {t('practiseAgain')}
          </button>
        ) : (
          <button
            type="button"
            className={SMALL}
            onClick={() => {
              setKnown(q.question, true);
              if (at < questions.length - 1) go(at + 1);
            }}
          >
            ✓ {t('iKnowIt')}
          </button>
        )}
        <span className="ml-auto flex gap-1.5">
          <button
            type="button"
            className={SMALL}
            disabled={at === 0}
            aria-label={t('prev')}
            onClick={() => {
              go(at - 1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className={SMALL}
            disabled={at === questions.length - 1}
            aria-label={t('next')}
            onClick={() => {
              go(at + 1);
            }}
          >
            ›
          </button>
        </span>
      </div>
    </article>
  );
}

/** Each gap: what to say if they ask, and one thing to learn this week. */
function Gaps({ body, focus }: { body: string; focus: GapFocus | null }) {
  const t = useTranslations('Jobs.interview.prep');
  const gaps = useMemo(() => parseGaps(body), [body]);
  const focused = focus ? findGap(gaps, focus.term) : -1;
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    if (focused >= 0) refs.current[focused]?.scrollIntoView({ block: 'nearest' });
  }, [focused, focus]);
  if (gaps.length === 0) return <Plain text={body} />;

  return (
    <ul className="space-y-2">
      {gaps.map((gap, i) => (
        <li
          key={gap.skill}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-current={i === focused ? 'true' : undefined}
          className={`space-y-1 rounded-xl border p-3 text-sm ${
            i === focused ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
          }`}
        >
          <p className="font-semibold text-slate-900">{gap.skill}</p>
          {gap.say && <p className="text-slate-800">{t('say', { say: gap.say })}</p>}
          {gap.learn && (
            <p className="text-xs text-slate-600">{t('learn', { learn: gap.learn })}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The research checklist. Ticks are kept in this browser, per job. */
function Research({ body, jobId }: { body: string; jobId: string }) {
  const items = useMemo(() => listItems(body), [body]);
  const [done, setDone] = useStoredList(`interview.research.${jobId}`);
  if (items.length === 0) return <Plain text={body} />;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item}>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-emerald-600"
              checked={done.includes(item)}
              onChange={(e) => {
                setDone(item, e.target.checked);
              }}
            />
            <span className={done.includes(item) ? 'text-slate-500 line-through' : undefined}>
              {item}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
