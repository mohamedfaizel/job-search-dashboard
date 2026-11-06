import type { JobInsights } from '@jobsearch/data';
import { useSetHaveTerm } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useToast } from '../../../components/Toasts';
import { placeFor } from '../keywordPlace';
import {
  appendTerm,
  contentLines,
  insertLine,
  lineLike,
  mentionsTerm,
  readLine,
  replaceLine,
  replaceWord,
  rewordLine,
  skillsLine,
  splitLines,
} from '../replyEdit';
import { usePopupLayout } from './popupLayout';
import type { PointedLine, ReplyDraftState } from './ReplyPreview';

type Mode = 'suggest' | 'rewrite' | 'insert' | 'replace';
const MODES: Mode[] = ['suggest', 'rewrite', 'insert', 'replace'];

const CHOICE = 'h-7 rounded-lg border px-2.5 text-xs font-medium';
const APPLY =
  'h-8 rounded-lg bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50';
const LINK = 'text-xs text-brand-700 hover:underline';

const short = (text: string) => (text.length > 70 ? `${text.slice(0, 67)}…` : text);

/** Picks a line of the resume, by its words. */
function LinePicker({
  label,
  text,
  value,
  onChange,
}: {
  label: string;
  text: string;
  value: number;
  onChange: (i: number) => void;
}) {
  const lines = splitLines(text);
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="h-8 rounded-md border border-slate-300 bg-white px-1 text-xs text-slate-800"
      >
        {contentLines(text).map((i) => (
          <option key={i} value={i}>
            {short(readLine(lines[i] ?? '').text)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** One way of working the keyword in, shown when its pill is picked. */
function Action({
  mode,
  term,
  related,
  resume,
  start,
  onLine,
  onApply,
}: {
  mode: Mode;
  term: string;
  related: string | null;
  resume: string;
  /** The line to start on: the one that fits the keyword best. */
  start: number;
  /** Tells which line is picked, so the preview can point at it. */
  onLine: (line: number) => void;
  onApply: (text: string) => void;
}) {
  const t = useTranslations('Jobs.keywordCards');
  const lines = splitLines(resume);
  const [line, setLine] = useState(start);
  const raw = lines[line] ?? '';
  const [words, setWords] = useState(() => (mode === 'insert' ? term : readLine(raw).text));
  const [word, setWord] = useState(related ?? '');

  if (mode === 'suggest') {
    const at = skillsLine(resume);
    if (at < 0) return <p className="text-xs text-slate-600">{t('noSkills')}</p>;
    const before = lines[at] ?? '';
    const after = appendTerm(before, term);
    return (
      <div className="space-y-1.5 rounded-md bg-slate-50 p-2 text-xs">
        <p className="text-slate-600">{t('suggestIntro')}</p>
        <p className="text-slate-500 line-through">{readLine(before).text}</p>
        <p className="text-slate-800">{readLine(after).text}</p>
        <button
          type="button"
          className={APPLY}
          onClick={() => {
            onApply(replaceLine(resume, at, after));
          }}
        >
          {t('apply')}
        </button>
      </div>
    );
  }

  if (mode === 'replace') {
    const result = replaceWord(resume, word, term);
    return (
      <div className="space-y-1.5 rounded-md bg-slate-50 p-2 text-xs">
        <label className="flex flex-wrap items-center gap-1.5 text-slate-600">
          {t('replaceLabel')}
          <input
            value={word}
            onChange={(e) => {
              setWord(e.target.value);
            }}
            className="h-7 w-36 rounded-md border border-slate-300 bg-white px-1.5 text-slate-800"
          />
          {t('replaceWith', { term })}
        </label>
        <p className="text-slate-600">{t('replaceFound', { count: result.lines })}</p>
        <button
          type="button"
          className={APPLY}
          disabled={result.lines === 0}
          onClick={() => {
            onApply(result.text);
          }}
        >
          {t('replaceAll')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md bg-slate-50 p-2 text-xs">
      <LinePicker
        label={mode === 'rewrite' ? t('rewriteLine') : t('insertUnder')}
        text={resume}
        value={line}
        onChange={(i) => {
          setLine(i);
          onLine(i);
          if (mode === 'rewrite') setWords(readLine(lines[i] ?? '').text);
        }}
      />
      <textarea
        value={words}
        aria-label={mode === 'rewrite' ? t('rewriteBox') : t('insertBox')}
        rows={2}
        onChange={(e) => {
          setWords(e.target.value);
        }}
        className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
      />
      {!mentionsTerm(words, term) && <p className="text-amber-800">{t('notInText', { term })}</p>}
      <button
        type="button"
        className={APPLY}
        disabled={!words.trim()}
        onClick={() => {
          onApply(
            mode === 'rewrite'
              ? replaceLine(resume, line, rewordLine(raw, words))
              : insertLine(resume, line, lineLike(raw, words.trim())),
          );
        }}
      >
        {mode === 'rewrite' ? t('apply') : t('insert')}
      </button>
    </div>
  );
}

/** The keywords the saved resume still leaves out, each once: the cards Missing keywords shows. */
export function missingTerms(insights: JobInsights): string[] {
  const jobResume = insights.jobResume;
  if (!jobResume) return [];
  const seen = new Set<string>();
  return [...jobResume.stillMissing, ...jobResume.aiMissing].filter((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Keywords of the ad (and Resume-Matcher's list) the resume Claude wrote still leaves out. Each
 * card works one in, right in the preview: add it to Skills, rewrite a line, insert a new line or
 * replace a word; or skip it. The bar counts how many of the job's terms the draft now covers.
 * Nothing is saved until you press Save changes in the preview.
 */
export function MissingKeywords({
  insights,
  state,
  onPoint,
}: {
  insights: JobInsights;
  state: ReplyDraftState;
  /** Points the preview at the resume line the picked keyword fits best (null: none). */
  onPoint?: (pointed: PointedLine | null) => void;
}) {
  const t = useTranslations('Jobs.keywordCards');
  const tToast = useTranslations('Jobs.toasts');
  const toast = useToast();
  const have = useSetHaveTerm();
  const jobResume = insights.jobResume;
  const [open, setOpen] = useState<{ term: string; mode: Mode } | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  // The keyword whose best line the preview points at, and the line you picked for it.
  const [focus, setFocus] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ term: string; line: number } | null>(null);
  const { adText } = usePopupLayout();

  const checks = [...insights.skills, ...insights.keywords];
  const known = new Map(checks.map((c) => [c.term.toLowerCase(), c]));
  const cards = missingTerms(insights);
  const all = [...new Set([...checks.map((c) => c.term), ...cards])];
  const resume = state.draft.resume;
  const covered = all.filter((term) => mentionsTerm(resume, term)).length;
  const placeOf = (term: string) =>
    placeFor(resume, term, adText, known.get(term.toLowerCase())?.relatedTo ?? null);

  // Where the focused keyword goes: the skills line for "Add to skills", the line you picked,
  // else the line that fits best. Nothing once it is in the resume.
  const focusMode = focus && open?.term === focus ? open.mode : null;
  const focusIn = focus !== null && mentionsTerm(resume, focus);
  const pointLine =
    focus === null || focusIn
      ? null
      : focusMode === 'suggest'
        ? skillsLine(resume)
        : picked?.term === focus
          ? picked.line
          : placeOf(focus).line;
  const note = focus ? t('fitsHere', { term: focus }) : '';
  useEffect(() => {
    onPoint?.(pointLine !== null && pointLine >= 0 ? { line: pointLine, note } : null);
  }, [onPoint, pointLine, note]);

  if (!jobResume || cards.length === 0) return null;

  return (
    <section
      aria-label={t('title')}
      className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-[15px] font-semibold text-slate-900">{t('title')}</h3>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-200 ring-inset">
          {t('covered', { covered, total: all.length })}
        </span>
        <span
          aria-hidden="true"
          className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-200"
        >
          <span
            className="block h-full rounded-full bg-emerald-500"
            style={{ width: `${String(all.length ? (covered / all.length) * 100 : 0)}%` }}
          />
        </span>
      </div>
      <p className="text-xs text-slate-600">{t('intro')}</p>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
        {cards.map((term) => {
          const check = known.get(term.toLowerCase());
          const isIn = mentionsTerm(resume, term);
          const isSkipped = skipped.includes(term);
          const yours = Boolean(check && (check.youHave || check.inResume || check.relatedTo));
          const mode = open?.term === term ? open.mode : null;
          return (
            <li key={term} aria-label={term} className={mode ? 'bg-slate-50' : undefined}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                <span
                  className={`min-w-0 flex-1 text-sm ${isSkipped ? 'text-slate-400 line-through' : 'text-slate-900'}`}
                >
                  {isIn || isSkipped ? (
                    <b>{term}</b>
                  ) : (
                    <button
                      type="button"
                      aria-pressed={focus === term}
                      title={t('showLine')}
                      onClick={() => {
                        setFocus(focus === term ? null : term);
                      }}
                      className={`rounded px-1 -mx-1 font-bold hover:bg-amber-50 ${
                        focus === term ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : ''
                      }`}
                    >
                      {term}
                    </button>
                  )}
                  {check?.relatedTo && !isIn && !isSkipped && (
                    <span className="ml-2 text-xs font-normal text-slate-500 no-underline">
                      {t('relatedTo', { term: check.relatedTo })}
                    </span>
                  )}
                </span>
                {isIn && <span className="text-xs text-emerald-700">{t('added')}</span>}
                {focus === term && !isIn && !isSkipped && (
                  <span className="order-last basis-full text-xs text-amber-800">
                    {(() => {
                      const words = placeOf(term).words;
                      return words.length
                        ? t('sharedWords', { words: words.join(', ') })
                        : t('noSharedWords');
                    })()}
                  </span>
                )}
                {isSkipped && (
                  <>
                    <span className="text-xs text-slate-500">{t('skipped')}</span>
                    <button
                      type="button"
                      className={LINK}
                      onClick={() => {
                        setSkipped((list) => list.filter((x) => x !== term));
                      }}
                    >
                      {t('unskip')}
                    </button>
                  </>
                )}
                {!isIn && !isSkipped && (
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label={t('ways', { term })}
                  >
                    {MODES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={mode === m}
                        aria-label={t(`modes.${m}`)}
                        title={t(`modes.${m}`)}
                        onClick={() => {
                          setOpen(mode === m ? null : { term, mode: m });
                          setFocus(term);
                          setPicked(null);
                        }}
                        className={`${CHOICE} ${
                          mode === m
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {t(`short.${m}`)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSkipped((list) => [...list, term]);
                        setOpen(null);
                      }}
                      className={`${CHOICE} border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
                    >
                      {t('skip')}
                    </button>
                  </div>
                )}
              </div>
              {mode && !isIn && (
                <div className="space-y-2 px-3 pb-3">
                  {!yours && (
                    <p
                      role="note"
                      className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800"
                    >
                      {t('factWarning', { term })}{' '}
                      {check && (
                        <button
                          type="button"
                          className="font-medium underline"
                          onClick={() => {
                            have.mutate({ jobId: insights.jobId, term, have: true });
                          }}
                        >
                          {t('iHaveIt')}
                        </button>
                      )}
                    </p>
                  )}
                  <Action
                    key={`${term}-${mode}`}
                    mode={mode}
                    term={term}
                    related={check?.relatedTo ?? null}
                    resume={resume}
                    start={picked?.term === term ? picked.line : placeOf(term).line}
                    onLine={(line) => {
                      setPicked({ term, line });
                    }}
                    onApply={(text) => {
                      state.change('resume', text);
                      setOpen(null);
                      setFocus(null);
                      setPicked(null);
                      toast(tToast('keywordAdded', { term }), { tone: 'info' });
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
