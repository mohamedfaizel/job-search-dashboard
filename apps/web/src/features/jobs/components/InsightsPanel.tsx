import type { JobInsights, RemovedTerm, TermCheck } from '@jobsearch/data';
import {
  useJobInsights,
  useRemoveInsightTerm,
  useRestoreInsightTerm,
  useSetHaveTerm,
} from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { useErrorText } from '../../../i18n/useErrorText';
import { useJobFormat } from '../useJobFormat';
import { Badge } from './Badge';
import { scoreTone } from './MatchPanel';

const CHIP =
  'inline-flex h-7 items-center gap-1 rounded-md pl-2 text-xs font-medium ring-1 ring-inset';
const CHIP_BUTTON = 'h-6 rounded px-1.5 leading-none hover:bg-black/10';
const LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase';

const RING_COLOR = { green: '#059669', orange: '#d97706', red: '#dc2626' } as const;

/** The score as a ring, so you see at a glance how close you are. */
export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = 23;
  const length = 2 * Math.PI * r;
  const tone = scoreTone(score) as keyof typeof RING_COLOR;
  const t = useTranslations('Jobs.fit');
  return (
    <svg
      role="img"
      aria-label={t('ringLabel', { score })}
      width={size}
      height={size}
      viewBox="0 0 56 56"
      className="shrink-0"
    >
      <circle cx="28" cy="28" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={RING_COLOR[tone]}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${String((score / 100) * length)} ${String(length)}`}
        transform="rotate(-90 28 28)"
      />
      <text
        x="28"
        y="32.5"
        textAnchor="middle"
        fontSize="14"
        fontWeight="600"
        className="fill-slate-900"
      >
        {score}%
      </text>
    </svg>
  );
}

/**
 * A small icon button with a tooltip that shows on hover and on keyboard focus (a plain `title`
 * waits a second and never shows for keyboard users). The tooltip is also its description for
 * screen readers.
 */
function IconButton({
  label,
  tooltip,
  onClick,
  className,
  children,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  const tipId = useId();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-describedby={tipId}
      className={`group relative ${CHIP_BUTTON} ${className}`}
    >
      <span aria-hidden="true">{children}</span>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-10 mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-normal whitespace-nowrap text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {tooltip}
      </span>
    </button>
  );
}

/**
 * A missing term. Skills get ✓ (you have it: the resume just doesn't say so) and ✕ (you don't,
 * or it isn't relevant). Keywords get no buttons: the prompt asks Claude to work in as many as
 * honestly fit. When you have a skill it goes with, the chip says so: a fair term for Claude to
 * add next to that experience.
 */
export function MissingChip({
  term,
  relatedTo,
  onHave,
  onRemove,
}: {
  term: string;
  relatedTo: string | null;
  onHave?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  const t = useTranslations('Jobs.fit');
  const related = relatedTo !== null;
  const buttons = onHave !== undefined || onRemove !== undefined;
  return (
    <span
      className={`${CHIP} ${buttons ? 'pr-0.5' : 'pr-2'} ${related ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200'}`}
    >
      {term}
      {related && (
        <span className="font-normal opacity-75">{t('relatedTo', { term: relatedTo })}</span>
      )}
      {onHave && (
        <IconButton
          label={t('iHave', { term })}
          tooltip={t('iHaveHint')}
          onClick={onHave}
          className="ml-0.5 font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          ✓
        </IconButton>
      )}
      {onRemove && (
        <IconButton
          label={t('remove', { term })}
          tooltip={t('removeHint')}
          onClick={onRemove}
          className="text-red-700 hover:bg-red-100"
        >
          ✕
        </IconButton>
      )}
    </span>
  );
}

/** A term you said you have: blue, counted as covered, with Undo. */
export function HaveChip({ term, onUndo }: { term: string; onUndo: () => void }) {
  const t = useTranslations('Jobs.fit');
  return (
    <span className={`${CHIP} bg-sky-50 pr-0.5 text-sky-800 ring-sky-200`} title={t('haveHint')}>
      ✓ {term}
      <button
        type="button"
        onClick={onUndo}
        aria-label={t('dontHave', { term })}
        className={`${CHIP_BUTTON} text-sky-700`}
      >
        {t('undo')}
      </button>
    </span>
  );
}

function MissingList({
  label,
  terms,
  onHave,
  onRemove,
}: {
  label: string;
  terms: TermCheck[];
  /** Left out for keywords: they get no buttons. */
  onHave?: (term: string) => void;
  onRemove?: (term: string) => void;
}) {
  if (terms.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {terms.map((t) => (
        <li key={t.term}>
          <MissingChip
            term={t.term}
            relatedTo={t.relatedTo}
            onHave={
              onHave &&
              (() => {
                onHave(t.term);
              })
            }
            onRemove={
              onRemove &&
              (() => {
                onRemove(t.term);
              })
            }
          />
        </li>
      ))}
    </ul>
  );
}

/** What you removed, folded away, with Undo and "all jobs" for noise that shows up everywhere. */
function RemovedTerms({
  removed,
  onRestore,
  onRemoveEverywhere,
}: {
  removed: RemovedTerm[];
  onRestore: (term: string) => void;
  onRemoveEverywhere: (term: string) => void;
}) {
  const t = useTranslations('Jobs.fit');
  if (removed.length === 0) return null;
  return (
    <details className="group text-xs text-slate-600">
      <summary className="cursor-pointer list-none">
        {t('removedSummary', { count: removed.length })} ·{' '}
        <span className="text-indigo-600 group-open:hidden">{t('show')}</span>
        <span className="hidden text-indigo-600 group-open:inline">{t('hide')}</span>
      </summary>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('removedLabel')}>
        {removed.map(({ term, everywhere }) => (
          <li key={term} className={`${CHIP} bg-white pr-0.5 text-slate-500 ring-slate-200`}>
            <span className="line-through">{term}</span>
            {everywhere ? (
              <span className="text-slate-400">{t('allJobsTag')}</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onRemoveEverywhere(term);
                }}
                aria-label={t('removeEverywhere', { term })}
                title={t('removeEverywhereHint')}
                className={`${CHIP_BUTTON} text-slate-500 underline decoration-dotted`}
              >
                {t('allJobs')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onRestore(term);
              }}
              aria-label={t('putBack', { term })}
              className={`${CHIP_BUTTON} text-indigo-700`}
            >
              {t('undo')}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The parts of our score, with the same weights as Resume-Matcher's ATS score. */
function scoreParts(insights: JobInsights) {
  return [
    { key: 'keywords', weight: '40%', value: insights.keywordsCoverage },
    { key: 'skills', weight: '20%', value: insights.skillsCoverage },
    { key: 'title', weight: '15%', value: insights.titleMatch },
    { key: 'sections', weight: '15%', value: 100, alwaysFull: true },
    { key: 'dates', weight: '10%', value: 100, alwaysFull: true },
  ] as const;
}

function count(terms: TermCheck[]) {
  return `${String(terms.filter((t) => t.inResume || t.youHave).length)}/${String(terms.length)}`;
}

/** Ring, short summary and "How is this worked out?" with the weighted parts. */
function Summary({ insights }: { insights: JobInsights }) {
  const { score, skills, keywords, titleMatch } = insights;
  const t = useTranslations('Jobs.fit');
  if (score === null) return null;
  return (
    <div className="flex items-start gap-4">
      <ScoreRing score={score} />
      <div className="min-w-0 flex-1 space-y-1 pt-1 text-sm text-slate-600">
        <p>
          {skills.length > 0 && `${t('skillsCount', { count: count(skills) })} · `}
          {keywords.length > 0 && `${t('keywordsCount', { count: count(keywords) })} · `}
          {t('titleValue', { value: titleMatch === null ? t('na') : `${String(titleMatch)}%` })}
        </p>
        <details className="group">
          <summary className="cursor-pointer list-none text-indigo-600 hover:text-indigo-800">
            {t('howWorked')}
          </summary>
          <p className="mt-1 text-xs text-slate-500">{t('howText')}</p>
          <ul
            aria-label={t('partsLabel')}
            className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500"
          >
            {scoreParts(insights).map((part) => {
              const label = t(`parts.${part.key}`);
              return (
                <li
                  key={part.key}
                  title={'alwaysFull' in part ? t('alwaysFull', { label }) : undefined}
                >
                  {label} {part.weight}: {part.value === null ? t('na') : `${part.value}%`}
                </li>
              );
            })}
          </ul>
        </details>
      </div>
    </div>
  );
}

/** Which language to write the resume in, and why. */
function Language({ insights }: { insights: JobInsights }) {
  const { language, languageDetected, germanRequired, germanLevelEstimated } = insights;
  const f = useJobFormat();
  const t = useTranslations('Jobs.fit');
  const level = f.germanLevel(insights);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <span>
        {t('adIn')}{' '}
        <span className="font-medium text-slate-700">
          {language ? f.language(language) : t('unknown')}
        </span>
        {languageDetected && <span className="text-slate-400"> {t('detected')}</span>}
      </span>
      {germanRequired ? (
        <span title={t('germanReason')}>
          <span title={germanLevelEstimated ? f.estimatedLevelHint : undefined}>
            <Badge tone="orange">
              {level ? t('germanLevelRequired', { level }) : t('germanRequired')}
            </Badge>
          </span>{' '}
          <span>{t('resumeGerman')}</span>
        </span>
      ) : (
        <span>{t('resumeEnglish')}</span>
      )}
      {insights.hasResume && <CheckedAgainst insights={insights} />}
    </p>
  );
}

/**
 * Which of your master resumes the Fit was checked against. When the ad is in another language
 * than that resume, most of its keywords can't be found, so it says how to fix that.
 */
function CheckedAgainst({ insights }: { insights: JobInsights }) {
  const { language, checkedAgainst } = insights;
  const mismatch = language !== null && language !== checkedAgainst;
  const f = useJobFormat();
  const t = useTranslations('Jobs.fit');
  return (
    <span className="basis-full">
      {t('checkedAgainst', { language: f.language(checkedAgainst) })}
      {mismatch && t('mismatch', { language: f.language(language) })}
    </span>
  );
}

/**
 * The Fit tab: skills and keywords of the job, checked against your resume text. Worked out on
 * our server with plain word matching and TF-IDF, so it is instant and free (no AI). Remove what
 * doesn't apply with × before you copy the Apply kit prompt.
 */
export function InsightsPanel({ jobId }: { jobId: string }) {
  const errorText = useErrorText();
  const insights = useJobInsights(jobId);
  const remove = useRemoveInsightTerm();
  const restore = useRestoreInsightTerm();
  const have = useSetHaveTerm();
  const t = useTranslations('Jobs.fit');

  if (insights.isPending) {
    return <p className="text-sm text-slate-500">{t('reading')}</p>;
  }
  if (insights.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t('readError', { error: errorText(insights.error) })}
      </p>
    );
  }

  const data = insights.data;
  const { hasResume, normalizedTitle } = data;
  const removeTerm = (term: string, everywhere = false) => {
    remove.mutate({ jobId, term, everywhere });
  };
  const setHave = (term: string, value: boolean) => {
    have.mutate({ jobId, term, have: value });
  };
  // Without a resume nothing is "found", so every term counts as missing.
  const isMissing = (t: TermCheck) => !t.youHave && (!hasResume || !t.inResume);
  const missingSkills = data.skills.filter(isMissing);
  const missingKeywords = data.keywords.filter(isMissing);
  const youHave = [...data.skills, ...data.keywords].filter((t) => t.youHave);
  const found = hasResume ? [...data.skills, ...data.keywords].filter((t) => t.inResume) : [];
  const changeError = remove.error ?? restore.error ?? have.error;

  return (
    <section aria-label={t('sectionLabel')} className="space-y-5 text-sm">
      {hasResume ? (
        <Summary insights={data} />
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{t('addResume')}</p>
      )}

      {missingSkills.length > 0 && (
        <div className="space-y-2">
          <h4 className={LABEL}>
            {hasResume ? t('skillsMissing') : t('skills')} · {missingSkills.length}
          </h4>
          <MissingList
            label={t('missingSkillsLabel')}
            terms={missingSkills}
            onHave={(term) => {
              setHave(term, true);
            }}
            onRemove={removeTerm}
          />
        </div>
      )}

      {missingKeywords.length > 0 && (
        <div className="space-y-2">
          <h4 className={LABEL}>
            {hasResume ? t('keywordsMissing') : t('keywords')} · {missingKeywords.length}
          </h4>
          <p className="text-xs text-slate-500">{t('keywordsHint')}</p>
          <MissingList label={t('missingKeywordsLabel')} terms={missingKeywords} />
        </div>
      )}

      {youHave.length > 0 && (
        <div className="space-y-2">
          <h4 className={LABEL}>
            {t('youHave')} · {youHave.length}
          </h4>
          <p className="text-xs text-slate-500">{t('youHaveHint')}</p>
          <ul className="flex flex-wrap gap-1.5" aria-label={t('youHave')}>
            {youHave.map((t) => (
              <li key={t.term}>
                <HaveChip
                  term={t.term}
                  onUndo={() => {
                    setHave(t.term, false);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {found.length > 0 && (
        <div className="space-y-2">
          <h4 className={LABEL}>
            {t('inResume')} · {found.length}
          </h4>
          <ul className="flex flex-wrap gap-1.5" aria-label={t('inResumeLabel')}>
            {found.map((t) => (
              <li
                key={t.term}
                className={`${CHIP} bg-emerald-50 pr-2 text-emerald-700 ring-emerald-200`}
              >
                ✓ {t.term}
              </li>
            ))}
          </ul>
        </div>
      )}

      <RemovedTerms
        removed={data.removed}
        onRestore={(term) => {
          restore.mutate({ jobId, term });
        }}
        onRemoveEverywhere={(term) => {
          removeTerm(term, true);
        }}
      />

      <div className="space-y-1 border-t border-slate-100 pt-3">
        {normalizedTitle && (
          <p className="text-xs text-slate-500">
            {t.rich('titleRead', {
              title: normalizedTitle,
              b: (chunks) => <span className="font-medium text-slate-700">{chunks}</span>,
            })}
          </p>
        )}
        <Language insights={data} />
      </div>

      {changeError && (
        <p role="alert" className="text-red-700">
          {t('changeError', { error: errorText(changeError) })}
        </p>
      )}
    </section>
  );
}
