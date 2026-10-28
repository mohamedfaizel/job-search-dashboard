import type { TermCheck } from '@jobsearch/data';
import { getErrorMessage, useJobInsights } from '@jobsearch/data';
import { languageName } from '../format';
import { Badge } from './Badge';

/** One group of terms: what your resume lacks in red, what it has in green. */
function TermGroup({
  label,
  terms,
  hasResume,
}: {
  label: string;
  terms: TermCheck[];
  hasResume: boolean;
}) {
  if (terms.length === 0) return null;
  const missing = terms.filter((t) => !t.inResume);
  const found = terms.filter((t) => t.inResume);

  if (!hasResume) {
    return (
      <div>
        <h4 className="text-xs font-medium text-slate-500 uppercase">{label}</h4>
        <ul className="mt-1 flex flex-wrap gap-1" aria-label={label}>
          {terms.map((t) => (
            <li key={t.term}>
              <Badge>{t.term}</Badge>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-slate-500 uppercase">
        {label}: {found.length} of {terms.length} in your resume
      </h4>
      {missing.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={`Missing ${label.toLowerCase()}`}>
          {missing.map((t) => (
            <li key={t.term}>
              <Badge tone="red" title="Not in your resume">
                {t.term}
              </Badge>
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

/**
 * Title, language, skills and keywords of the job, checked against your resume text. Worked out
 * on our server with plain word matching and TF-IDF, so it is instant and free (no AI).
 */
export function InsightsPanel({ jobId }: { jobId: string }) {
  const insights = useJobInsights(jobId);

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

  const { normalizedTitle, language, languageDetected, hasResume, skills, keywords } =
    insights.data;
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
      </div>
      {!hasResume && (
        <p className="text-slate-600">
          Add your resume on “My profile” to see which of these you are missing.
        </p>
      )}
      <TermGroup label="Skills" terms={skills} hasResume={hasResume} />
      <TermGroup label="Keywords" terms={keywords} hasResume={hasResume} />
    </section>
  );
}
