import type { JobInsights, RemovedTerm, TermCheck } from '@jobsearch/data';
import {
  getErrorMessage,
  useJobInsights,
  useRemoveInsightTerm,
  useRestoreInsightTerm,
  useSetHaveTerm,
} from '@jobsearch/data';
import { languageName } from '../format';
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
  return (
    <svg
      role="img"
      aria-label={`${String(score)} percent fit`}
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
 * A missing term with "I have it" (you know it, the resume just doesn't say so) and × to remove
 * it ("I don't have it" or "not relevant"). When you have a skill it goes with, the chip says
 * so: a fair term for Claude to add next to that experience.
 */
export function MissingChip({
  term,
  relatedTo,
  onHave,
  onRemove,
}: {
  term: string;
  relatedTo: string | null;
  onHave: () => void;
  onRemove?: () => void;
}) {
  const related = relatedTo !== null;
  return (
    <span
      className={`${CHIP} pr-0.5 ${related ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200'}`}
      title={
        related
          ? `Not in your resume, but it goes with ${relatedTo}, which you have`
          : 'Not in your resume'
      }
    >
      {term}
      {related && <span className="font-normal opacity-75">(you have {relatedTo})</span>}
      <button
        type="button"
        onClick={onHave}
        aria-label={`I have ${term}`}
        title="I have this: add it to my skills, count it, and ask Claude to put it in the resume"
        className={`${CHIP_BUTTON} ml-0.5 font-semibold text-sky-700`}
      >
        ✓ I have it
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${term}`}
          className={CHIP_BUTTON}
        >
          ×
        </button>
      )}
    </span>
  );
}

/** A term you said you have: blue, counted as covered, with Undo. */
export function HaveChip({ term, onUndo }: { term: string; onUndo: () => void }) {
  return (
    <span
      className={`${CHIP} bg-sky-50 pr-0.5 text-sky-800 ring-sky-200`}
      title="On your profile’s Skills list: counted as covered, and the prompt asks Claude to add it"
    >
      ✓ {term}
      <button
        type="button"
        onClick={onUndo}
        aria-label={`I don’t have ${term}`}
        className={`${CHIP_BUTTON} text-sky-700`}
      >
        Undo
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
  onHave: (term: string) => void;
  onRemove: (term: string) => void;
}) {
  if (terms.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {terms.map((t) => (
        <li key={t.term}>
          <MissingChip
            term={t.term}
            relatedTo={t.relatedTo}
            onHave={() => {
              onHave(t.term);
            }}
            onRemove={() => {
              onRemove(t.term);
            }}
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
  if (removed.length === 0) return null;
  return (
    <details className="group text-xs text-slate-600">
      <summary className="cursor-pointer list-none">
        {removed.length} {removed.length === 1 ? 'term' : 'terms'} removed, left out of the score
        and the prompt · <span className="text-indigo-600 group-open:hidden">Show</span>
        <span className="hidden text-indigo-600 group-open:inline">Hide</span>
      </summary>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Removed terms">
        {removed.map(({ term, everywhere }) => (
          <li key={term} className={`${CHIP} bg-white pr-0.5 text-slate-500 ring-slate-200`}>
            <span className="line-through">{term}</span>
            {everywhere ? (
              <span className="text-slate-400">(all jobs)</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onRemoveEverywhere(term);
                }}
                aria-label={`Remove ${term} from all jobs`}
                title="Remove from all jobs"
                className={`${CHIP_BUTTON} text-slate-500 underline decoration-dotted`}
              >
                all jobs
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onRestore(term);
              }}
              aria-label={`Put back ${term}`}
              className={`${CHIP_BUTTON} text-indigo-700`}
            >
              Undo
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
    { label: 'Keywords', weight: '40%', value: insights.keywordsCoverage },
    { label: 'Skills', weight: '20%', value: insights.skillsCoverage },
    { label: 'Job title', weight: '15%', value: insights.titleMatch },
    { label: 'Sections', weight: '15%', value: 100, note: 'always full' },
    { label: 'Dates', weight: '10%', value: 100, note: 'always full' },
  ];
}

function count(terms: TermCheck[]) {
  return `${String(terms.filter((t) => t.inResume || t.youHave).length)}/${String(terms.length)}`;
}

/** Ring, short summary and "How is this worked out?" with the weighted parts. */
function Summary({ insights }: { insights: JobInsights }) {
  const { score, skills, keywords, titleMatch } = insights;
  if (score === null) return null;
  return (
    <div className="flex items-start gap-4">
      <ScoreRing score={score} />
      <div className="min-w-0 flex-1 space-y-1 pt-1 text-sm text-slate-600">
        <p>
          {skills.length > 0 && `Skills ${count(skills)} · `}
          {keywords.length > 0 && `Keywords ${count(keywords)} · `}
          Title {titleMatch === null ? 'n/a' : `${String(titleMatch)}%`}
        </p>
        <details className="group">
          <summary className="cursor-pointer list-none text-indigo-600 hover:text-indigo-800">
            How is this worked out?
          </summary>
          <p className="mt-1 text-xs text-slate-500">
            Plain word matching against your resume (free, no AI), weighted like Resume-Matcher’s
            ATS score:
          </p>
          <ul
            aria-label="Score parts"
            className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500"
          >
            {scoreParts(insights).map(({ label, weight, value, note }) => (
              <li key={label} title={note ? `${label}: not checked here, ${note}` : undefined}>
                {label} {weight}: {value === null ? 'n/a' : `${value}%`}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

/** Which language to write the resume in, and why. */
function Language({ insights }: { insights: JobInsights }) {
  const { language, languageDetected, germanRequired, germanLevel } = insights;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <span>
        Ad in{' '}
        <span className="font-medium text-slate-700">
          {language ? languageName(language) : 'Unknown'}
        </span>
        {languageDetected && <span className="text-slate-400"> (detected)</span>}
      </span>
      {germanRequired ? (
        <span title="The ad is in German or asks for German, so the prompt asks for a German resume">
          <Badge tone="orange">German required{germanLevel ? ` (${germanLevel})` : ''}</Badge>{' '}
          <span>· resume in German</span>
        </span>
      ) : (
        <span>· Resume in English</span>
      )}
    </p>
  );
}

/**
 * The Fit tab: skills and keywords of the job, checked against your resume text. Worked out on
 * our server with plain word matching and TF-IDF, so it is instant and free (no AI). Remove what
 * doesn't apply with × before you copy the Apply kit prompt.
 */
export function InsightsPanel({ jobId }: { jobId: string }) {
  const insights = useJobInsights(jobId);
  const remove = useRemoveInsightTerm();
  const restore = useRestoreInsightTerm();
  const have = useSetHaveTerm();

  if (insights.isPending) {
    return <p className="text-sm text-slate-500">Reading the job…</p>;
  }
  if (insights.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Could not read the job: {getErrorMessage(insights.error)}
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
  const missingCount = missingSkills.length + missingKeywords.length;
  const changeError = remove.error ?? restore.error ?? have.error;

  return (
    <section aria-label="Skills and keywords" className="space-y-5 text-sm">
      {hasResume ? (
        <Summary insights={data} />
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          Add your resume on “My profile” to see which of these you are missing.
        </p>
      )}

      {missingCount > 0 && (
        <div className="space-y-2">
          <h4 className={LABEL}>
            {hasResume ? 'Missing from your resume' : 'Skills and keywords'} · {missingCount}
          </h4>
          <MissingList
            label="Missing skills"
            terms={missingSkills}
            onHave={(term) => {
              setHave(term, true);
            }}
            onRemove={removeTerm}
          />
          <MissingList
            label="Missing keywords"
            terms={missingKeywords}
            onHave={(term) => {
              setHave(term, true);
            }}
            onRemove={removeTerm}
          />
        </div>
      )}

      {youHave.length > 0 && (
        <div className="space-y-2">
          <h4 className={LABEL}>You have these · {youHave.length}</h4>
          <p className="text-xs text-slate-500">
            On your profile’s Skills list, so they count for every job. Your resume doesn’t name
            them yet: the prompt asks Claude to add them.
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-label="You have these">
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
          <h4 className={LABEL}>Already in your resume · {found.length}</h4>
          <ul className="flex flex-wrap gap-1.5" aria-label="In your resume">
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
            Title read as <span className="font-medium text-slate-700">{normalizedTitle}</span>
          </p>
        )}
        <Language insights={data} />
      </div>

      {changeError && (
        <p role="alert" className="text-red-700">
          Could not change that: {getErrorMessage(changeError)}
        </p>
      )}
    </section>
  );
}
