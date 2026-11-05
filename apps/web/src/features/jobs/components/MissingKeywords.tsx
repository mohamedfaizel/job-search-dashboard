import type { JobInsights } from '@jobsearch/data';
import { useSetHaveTerm } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  appendTerm,
  bestLine,
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
import type { ReplyDraftState } from './ReplyPreview';

type Mode = 'suggest' | 'rewrite' | 'insert' | 'replace';
const MODES: Mode[] = ['suggest', 'rewrite', 'insert', 'replace'];

const PILL = 'rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset';
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
  onApply,
}: {
  mode: Mode;
  term: string;
  related: string | null;
  resume: string;
  onApply: (text: string) => void;
}) {
  const t = useTranslations('Jobs.keywordCards');
  const lines = splitLines(resume);
  const [line, setLine] = useState(() => bestLine(resume, related));
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

/**
 * Keywords of the ad (and Resume-Matcher's list) the resume Claude wrote still leaves out. Each
 * card works one in, right in the preview: add it to Skills, rewrite a line, insert a new line or
 * replace a word; or skip it. The bar counts how many of the job's terms the draft now covers.
 * Nothing is saved until you press Save changes in the preview.
 */
export function MissingKeywords({
  insights,
  state,
}: {
  insights: JobInsights;
  state: ReplyDraftState;
}) {
  const t = useTranslations('Jobs.keywordCards');
  const have = useSetHaveTerm();
  const jobResume = insights.jobResume;
  const [open, setOpen] = useState<{ term: string; mode: Mode } | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  if (!jobResume) return null;

  const checks = [...insights.skills, ...insights.keywords];
  const known = new Map(checks.map((c) => [c.term.toLowerCase(), c]));
  const seen = new Set<string>();
  const cards = [...jobResume.stillMissing, ...jobResume.aiMissing].filter((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const all = [...new Set([...checks.map((c) => c.term), ...cards])];
  const resume = state.draft.resume;
  const covered = all.filter((term) => mentionsTerm(resume, term)).length;
  if (cards.length === 0) return null;

  return (
    <section
      aria-label={t('title')}
      className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4"
    >
      <div className="space-y-1.5">
        <h3 className="text-[15px] font-semibold text-slate-900">{t('title')}</h3>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>{t('covered', { covered, total: all.length })}</span>
          <span
            aria-hidden="true"
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
          >
            <span
              className="block h-full rounded-full bg-emerald-500"
              style={{ width: `${String(all.length ? (covered / all.length) * 100 : 0)}%` }}
            />
          </span>
        </div>
        <p className="text-xs text-slate-600">{t('intro')}</p>
      </div>
      <ul className="space-y-2">
        {cards.map((term) => {
          const check = known.get(term.toLowerCase());
          const isIn = mentionsTerm(resume, term);
          const isSkipped = skipped.includes(term);
          const yours = Boolean(check && (check.youHave || check.inResume || check.relatedTo));
          const mode = open?.term === term ? open.mode : null;
          return (
            <li
              key={term}
              aria-label={term}
              className={`space-y-2 rounded-lg border p-2.5 ${
                mode ? 'border-slate-900 ring-2 ring-brand-200' : 'border-slate-200'
              } ${isIn || isSkipped ? 'opacity-80' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`${PILL} ${
                    isIn
                      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                      : isSkipped
                        ? 'bg-slate-50 text-slate-500 ring-slate-200'
                        : 'bg-amber-50 text-amber-800 ring-amber-200'
                  }`}
                >
                  {isIn ? t('added') : isSkipped ? t('skipped') : t('missing')}
                </span>
                <b className="text-sm text-slate-900">{term}</b>
                {check?.relatedTo && !isIn && (
                  <span className="text-xs text-slate-500">
                    {t('relatedTo', { term: check.relatedTo })}
                  </span>
                )}
                {isSkipped && (
                  <button
                    type="button"
                    className={LINK}
                    onClick={() => {
                      setSkipped((list) => list.filter((x) => x !== term));
                    }}
                  >
                    {t('unskip')}
                  </button>
                )}
              </div>
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
                      onClick={() => {
                        setOpen(mode === m ? null : { term, mode: m });
                      }}
                      className={`${PILL} ${
                        mode === m
                          ? 'bg-brand-600 text-white ring-brand-600'
                          : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {t(`modes.${m}`)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSkipped((list) => [...list, term]);
                      setOpen(null);
                    }}
                    className={`${PILL} bg-white text-slate-700 ring-slate-300 hover:bg-slate-50`}
                  >
                    {t('skip')}
                  </button>
                </div>
              )}
              {mode && !isIn && !yours && (
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
              {mode && !isIn && (
                <Action
                  key={`${term}-${mode}`}
                  mode={mode}
                  term={term}
                  related={check?.relatedTo ?? null}
                  resume={resume}
                  onApply={(text) => {
                    state.change('resume', text);
                    setOpen(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
