import type { JobInsights, RemovedTerm, TermCheck } from '@jobsearch/data';
import {
  getErrorMessage,
  useJobInsights,
  useRemoveInsightTerm,
  useRestoreInsightTerm,
} from '@jobsearch/data';
import { useState } from 'react';
import { languageName } from '../format';
import { Badge } from './Badge';
import { JobResumePanel } from './JobResumePanel';
import { scoreTone } from './MatchPanel';

const CHIP =
  'inline-flex items-center gap-1 rounded py-0.5 pl-1.5 text-xs font-medium ring-1 ring-inset';
const CHIP_BUTTON = 'rounded px-1 leading-none hover:bg-black/10';

/**
 * A missing term with × to remove it ("I don't have it" or "not relevant"). When you have a
 * skill it goes with, the chip says so: a fair term for Claude to add next to that experience.
 */
function MissingChip({
  term,
  relatedTo,
  onRemove,
}: {
  term: string;
  relatedTo: string | null;
  onRemove: () => void;
}) {
  const related = relatedTo !== null;
  return (
    <span
      className={`${CHIP} ${related ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200'}`}
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
        onClick={onRemove}
        aria-label={`Remove ${term}`}
        className={CHIP_BUTTON}
      >
        ×
      </button>
    </span>
  );
}

/** One group of terms: what your resume lacks in red, what it has in green. */
function TermGroup({
  label,
  terms,
  hasResume,
  coverage,
  onRemove,
}: {
  label: string;
  terms: TermCheck[];
  hasResume: boolean;
  coverage: number | null;
  onRemove: (term: string) => void;
}) {
  if (terms.length === 0) return null;
  // Without a resume nothing is "found", so every term counts as missing.
  const missing = terms.filter((t) => !hasResume || !t.inResume);
  const found = hasResume ? terms.filter((t) => t.inResume) : [];

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-slate-500 uppercase">
        {label}
        {hasResume && `: ${found.length} of ${terms.length} in your resume (${coverage ?? 0}%)`}
      </h4>
      {missing.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={`Missing ${label.toLowerCase()}`}>
          {missing.map((t) => (
            <li key={t.term}>
              <MissingChip
                term={t.term}
                relatedTo={t.relatedTo}
                onRemove={() => {
                  onRemove(t.term);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {found.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={`${label} in your resume`}>
          {found.map((t) => (
            <li key={t.term}>
              <Badge tone="green" title="In your resume">
                ✓ {t.term}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What you removed, with Undo, and "all jobs" for noise that shows up everywhere. */
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
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-slate-500 uppercase">
        Removed (left out of the prompt and the score)
      </h4>
      <ul className="flex flex-wrap gap-1" aria-label="Removed terms">
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
    </div>
  );
}

/** Copies the ready-made prompt, so the resume is written in Claude desktop or web. */
function CopyPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied('yes');
    } catch {
      // Clipboard access can be blocked; the prompt below can still be selected by hand.
      setCopied('failed');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void copy();
          }}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Copy prompt for Claude
        </button>
        <a
          href="https://claude.ai/new"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-indigo-700 hover:underline"
        >
          Open Claude ↗
        </a>
        {copied && (
          <span role="status" className="text-sm text-slate-600">
            {copied === 'yes'
              ? 'Copied. Paste it into Claude to write a resume for this job.'
              : 'Could not copy. Select the prompt below instead.'}
          </span>
        )}
      </div>
      <details open={copied === 'failed'}>
        <summary className="cursor-pointer text-xs text-slate-500">Show the prompt</summary>
        <textarea
          readOnly
          value={prompt}
          aria-label="Prompt for Claude"
          rows={10}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700"
          onFocus={(e) => {
            e.currentTarget.select();
          }}
        />
      </details>
    </div>
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

function Score({ insights }: { insights: JobInsights }) {
  const { score } = insights;
  if (score === null) return null;
  return (
    <div className="ml-auto flex flex-col items-end gap-0.5">
      <span className="flex items-center gap-2">
        <span className="text-slate-600">Your resume covers</span>
        <Badge tone={scoreTone(score)}>{score}%</Badge>
      </span>
      <ul
        aria-label="Score parts"
        className="flex flex-wrap justify-end gap-x-3 text-xs text-slate-500"
      >
        {scoreParts(insights).map(({ label, weight, value, note }) => (
          <li key={label} title={note ? `${label}: not checked here, ${note}` : undefined}>
            {label} {weight}: {value === null ? 'n/a' : `${value}%`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Title, language, skills and keywords of the job, checked against your resume text. Worked out
 * on our server with plain word matching and TF-IDF, so it is instant and free (no AI). Remove
 * what doesn't apply with ×, copy a prompt to write the resume in Claude, then bring it back.
 */
export function InsightsPanel({ jobId }: { jobId: string }) {
  const insights = useJobInsights(jobId);
  const remove = useRemoveInsightTerm();
  const restore = useRestoreInsightTerm();

  if (insights.isPending) {
    return (
      <p className="border-b border-slate-200 px-5 py-3 text-sm text-slate-500">Reading the job…</p>
    );
  }
  if (insights.isError) {
    return (
      <p role="alert" className="border-b border-slate-200 px-5 py-3 text-sm text-red-700">
        Could not read the job: {getErrorMessage(insights.error)}
      </p>
    );
  }

  const data = insights.data;
  const { normalizedTitle, language, languageDetected, hasResume } = data;
  const removeTerm = (term: string, everywhere = false) => {
    remove.mutate({ jobId, term, everywhere });
  };
  const changeError = remove.error ?? restore.error;

  return (
    <section
      aria-label="Skills and keywords"
      className="space-y-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
        {normalizedTitle && (
          <span>
            Title: <span className="font-medium text-slate-900">{normalizedTitle}</span>
          </span>
        )}
        <span>
          Language:{' '}
          <span className="font-medium text-slate-900">
            {language ? languageName(language) : 'Unknown'}
          </span>
          {languageDetected && <span className="text-slate-400"> (detected)</span>}
        </span>
        <Score insights={data} />
      </div>
      {!hasResume && (
        <p className="text-slate-600">
          Add your resume on “My profile” to see which of these you are missing.
        </p>
      )}
      <TermGroup
        label="Skills"
        terms={data.skills}
        hasResume={hasResume}
        coverage={data.skillsCoverage}
        onRemove={removeTerm}
      />
      <TermGroup
        label="Keywords"
        terms={data.keywords}
        hasResume={hasResume}
        coverage={data.keywordsCoverage}
        onRemove={removeTerm}
      />
      <RemovedTerms
        removed={data.removed}
        onRestore={(term) => {
          restore.mutate({ jobId, term });
        }}
        onRemoveEverywhere={(term) => {
          removeTerm(term, true);
        }}
      />
      {changeError && (
        <p role="alert" className="text-red-700">
          Could not change that: {getErrorMessage(changeError)}
        </p>
      )}
      <CopyPrompt prompt={data.prompt} />
      <JobResumePanel insights={data} />
    </section>
  );
}
