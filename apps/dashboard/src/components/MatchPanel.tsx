import type { JobMatch } from '@jobsearch/data';
import { getErrorMessage, useJobMatch, useMatchJob } from '@jobsearch/data';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';

/** The same colours in the table and the popup: green is a strong fit, red a weak one. */
export function scoreTone(score: number): BadgeTone {
  if (score >= 75) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

/** The five parts of Resume-Matcher's ATS score, with their weights. */
const PARTS: { key: keyof JobMatch; label: string; weight: string; hint: string }[] = [
  {
    key: 'keywordMatch',
    label: 'Keywords',
    weight: '40%',
    hint: "The job's keywords found in your resume",
  },
  {
    key: 'skillsCoverage',
    label: 'Skills',
    weight: '20%',
    hint: "The job's required and preferred skills in your resume",
  },
  {
    key: 'titleMatch',
    label: 'Job title',
    weight: '15%',
    hint: 'The exact job title in your headline (best) or summary',
  },
  {
    key: 'sectionCompleteness',
    label: 'Sections',
    weight: '15%',
    hint: 'Contact details, summary, experience, education and skills present',
  },
  {
    key: 'dateConsistency',
    label: 'Dates',
    weight: '10%',
    hint: 'All dates written in one format',
  },
];

const BAR: Record<BadgeTone, string> = {
  green: 'bg-emerald-500',
  orange: 'bg-orange-400',
  red: 'bg-red-500',
  gray: 'bg-slate-400',
  purple: 'bg-violet-500',
  blue: 'bg-sky-500',
  pink: 'bg-pink-500',
};

const BUTTON =
  'rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60';

/**
 * The resume match inside the job popup: a button to start one, progress while Resume-Matcher
 * works (a minute or two), and the ATS score with what to improve once it is done.
 */
export function MatchPanel({ jobId }: { jobId: string }) {
  const match = useJobMatch(jobId);
  const start = useMatchJob();
  const data = match.data;
  const pending = start.isPending || data?.status === 'PENDING';

  const startButton = (label: string) => (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        start.mutate(jobId);
      }}
      className={BUTTON}
    >
      {label}
    </button>
  );

  return (
    <section
      aria-labelledby="match-title"
      className="space-y-3 border-b border-slate-200 px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="match-title" className="text-sm font-semibold text-slate-900">
          Resume match
        </h3>
        {data?.status === 'READY' && startButton('Match again')}
      </div>

      {/* aria-live announces "Matching…" and the result to screen readers. */}
      <div aria-live="polite" className="space-y-3">
        {match.isPending ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : pending ? (
          <p className="text-sm text-slate-700">
            Matching your resume against this job… This usually takes one to two minutes. You can
            close this popup; the score will appear in the Match column.
          </p>
        ) : !data ? (
          <div className="flex flex-wrap items-center gap-3">
            {startButton('Match my resume')}
            <span className="text-xs text-slate-500">
              Resume-Matcher scores your resume like an ATS would. Uses a few cents of AI credit.
            </span>
          </div>
        ) : data.status === 'FAILED' ? (
          <div className="space-y-2">
            <p className="text-sm text-red-700">{data.error ?? 'The match failed.'}</p>
            {startButton('Try again')}
          </div>
        ) : (
          <MatchResult match={data} />
        )}
        {start.isError && (
          <p role="alert" className="text-sm text-red-700">
            {getErrorMessage(start.error)}
          </p>
        )}
      </div>
    </section>
  );
}

function MatchResult({ match }: { match: JobMatch }) {
  const score = match.score ?? 0;
  return (
    <div className="space-y-4">
      {match.outdated && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You sent a newer resume since this score. Match again for a current one.
        </p>
      )}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-3xl font-semibold text-slate-900">
          {Math.round(score)}
          <span className="text-base font-normal text-slate-500"> / 100 ATS score</span>
        </p>
        <Badge tone={scoreTone(score)}>
          {score >= 75 ? 'Strong fit' : score >= 50 ? 'Partial fit' : 'Weak fit'}
        </Badge>
      </div>
      <p className="text-xs text-slate-500">
        Scored after a light tailoring of {match.resumeFileName ?? 'your resume'}
        {match.keywordMatchBefore !== null &&
          `. As it is now, it has ${String(Math.round(match.keywordMatchBefore))}% of the job's keywords`}
        .
      </p>

      <dl className="grid gap-2 sm:grid-cols-2">
        {PARTS.map(({ key, label, weight, hint }) => {
          const value = match[key] as number | null;
          return (
            <div key={key} title={hint}>
              <dt className="flex justify-between text-xs text-slate-600">
                <span>
                  {label} <span className="text-slate-400">({weight})</span>
                </span>
                <span className="font-medium text-slate-900">
                  {value === null ? 'n/a' : `${String(Math.round(value))}%`}
                </span>
              </dt>
              <dd className="mt-1 h-1.5 overflow-hidden rounded bg-slate-100">
                {value !== null && (
                  <div
                    className={`h-full ${BAR[scoreTone(value)]}`}
                    style={{ width: `${String(Math.min(100, Math.max(0, value)))}%` }}
                  />
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <KeywordList title="Missing from your resume" keywords={match.missingKeywords} tone="red" />
      <KeywordList
        title="In your resume, but not where an ATS looks"
        keywords={match.injectableKeywords}
        tone="orange"
      />
      {match.recommendations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-700">How to improve</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {match.recommendations.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KeywordList({
  title,
  keywords,
  tone,
}: {
  title: string;
  keywords: string[];
  tone: BadgeTone;
}) {
  if (keywords.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-700">{title}</h4>
      <div className="mt-1 flex flex-wrap gap-1">
        {keywords.map((keyword) => (
          <Badge key={keyword} tone={tone}>
            {keyword}
          </Badge>
        ))}
      </div>
    </div>
  );
}
