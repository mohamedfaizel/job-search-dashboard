import type { Job, JobFilterOptions, JobSortField, ListFilterKey } from '@jobsearch/data';
import { APPLICATION_STATUSES, WORKPLACES } from '@jobsearch/data';
import { createColumnHelper, tableFeatures } from '@tanstack/react-table';
import { createContext, useContext } from 'react';
import { capitalize, formatDate, formatSalary, STATUS_LABELS, WORKPLACE_LABELS } from '../format';
import type { BadgeTone } from './Badge';
import { Badge } from './Badge';
import { scoreTone } from './MatchPanel';
import { StatusSelect } from './StatusSelect';

const dash = <span className="text-slate-400">–</span>;

/** Row actions, provided by the table so cell renderers can stay at module scope. */
export interface RowActions {
  openJob: (job: Job) => void;
  setStatus: (job: Job, status: Job['applicationStatus']) => void;
  /** Hides the job from your table, or brings it back when hidden jobs are shown. */
  toggleHidden: (job: Job) => void;
  /** True while the table lists the jobs you hid. */
  showingHidden?: boolean;
}
export const RowActionsContext = createContext<RowActions | null>(null);
function useRowActions(): RowActions {
  const actions = useContext(RowActionsContext);
  if (!actions) throw new Error('RowActionsContext is missing');
  return actions;
}

// Sorting, filtering and paging all happen on the server, so the table only needs its
// core features. Defined once at module scope, as TanStack Table recommends.
export const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Job>();

const INDUSTRY_TONES: BadgeTone[] = ['green', 'purple', 'pink', 'blue', 'orange', 'red'];
function toneFor(text: string): BadgeTone {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return INDUSTRY_TONES[Math.abs(hash) % INDUSTRY_TONES.length] ?? 'gray';
}

function CompanyCell({ job }: { job: Job }) {
  const { name, logoUrl } = job.company;
  return (
    <div className="flex items-center gap-2">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-6 w-6 shrink-0 rounded border border-slate-200" />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 text-xs text-slate-500"
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="max-w-40 truncate font-medium text-slate-900" title={name}>
        {name}
      </span>
    </div>
  );
}

function TitleCell({ job }: { job: Job }) {
  const { openJob } = useRowActions();
  return (
    <button
      type="button"
      onClick={() => {
        openJob(job);
      }}
      className="max-w-80 truncate text-left font-medium text-slate-900 hover:text-indigo-700 hover:underline"
      title={job.title}
    >
      {job.title}
    </button>
  );
}

function SkillsCell({ skills }: { skills: string[] }) {
  if (skills.length === 0) return <span className="text-slate-400">–</span>;
  const shown = skills.slice(0, 2);
  const rest = skills.length - shown.length;
  return (
    <div className="flex items-center gap-1">
      {shown.map((skill) => (
        <Badge key={skill}>{skill}</Badge>
      ))}
      {rest > 0 && (
        <span className="text-xs text-slate-500" title={skills.slice(2).join(', ')}>
          +{rest}
        </span>
      )}
    </div>
  );
}

function StatusCell({ job }: { job: Job }) {
  const { setStatus } = useRowActions();
  return (
    <StatusSelect
      label={`Status for ${job.title} at ${job.company.name}`}
      value={job.applicationStatus}
      onChange={(status) => {
        setStatus(job, status);
      }}
    />
  );
}

/** Your ATS score for the job; clicking it opens the popup with the breakdown. */
function MatchCell({ job }: { job: Job }) {
  const { openJob } = useRowActions();
  const { matchStatus, matchScore } = job;
  if (!matchStatus) return dash;
  const label =
    matchStatus === 'PENDING'
      ? 'Matching…'
      : matchStatus === 'FAILED' || matchScore === null
        ? 'Failed'
        : String(Math.round(matchScore));
  const tone: BadgeTone =
    matchStatus === 'READY' && matchScore !== null ? scoreTone(matchScore) : 'gray';
  return (
    <button
      type="button"
      onClick={() => {
        openJob(job);
      }}
      aria-label={`Resume match for ${job.title}: ${label}`}
      className="rounded"
    >
      <Badge tone={tone}>{label}</Badge>
    </button>
  );
}

function HideCell({ job }: { job: Job }) {
  const { toggleHidden, showingHidden = false } = useRowActions();
  const action = showingHidden ? 'Unhide' : 'Hide';
  return (
    <button
      type="button"
      aria-label={`${action} ${job.title} at ${job.company.name}`}
      onClick={() => {
        toggleHidden(job);
      }}
      className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    >
      {action}
    </button>
  );
}

export const columns = helper.columns([
  helper.display({
    id: 'company',
    header: 'Company',
    cell: ({ row }) => <CompanyCell job={row.original} />,
  }),
  helper.accessor('postedAt', {
    header: 'Posted',
    cell: (info) => <span className="whitespace-nowrap">{formatDate(info.getValue())}</span>,
  }),
  helper.display({
    id: 'title',
    header: 'Job title',
    cell: ({ row }) => <TitleCell job={row.original} />,
  }),
  // Next to the title, so the score is visible without scrolling the wide table sideways.
  helper.display({
    id: 'match',
    header: 'Match',
    cell: ({ row }) => <MatchCell job={row.original} />,
  }),
  helper.accessor('jobFunction', {
    header: 'Function',
    cell: (info) => {
      const value = info.getValue();
      return value ? <Badge tone="red">{value}</Badge> : dash;
    },
  }),
  helper.accessor('seniority', {
    header: 'Seniority',
    cell: (info) => {
      const value = info.getValue();
      return value ? <Badge tone="orange">{capitalize(value)}</Badge> : dash;
    },
  }),
  helper.accessor('skills', {
    header: 'Skills',
    cell: (info) => <SkillsCell skills={info.getValue()} />,
  }),
  helper.accessor('city', {
    header: 'City',
    cell: (info) => <span className="whitespace-nowrap">{info.getValue() ?? '–'}</span>,
  }),
  helper.display({
    id: 'salary',
    header: 'Salary',
    cell: ({ row }) => {
      const job = row.original;
      const salary = formatSalary(job.salaryMinUsd, job.salaryMaxUsd);
      if (!salary) return dash;
      return (
        <span
          className="whitespace-nowrap"
          title={job.salaryEstimated ? 'Estimated by JobsPipe' : 'Stated in the posting'}
        >
          {salary}
          {job.salaryEstimated && <span className="text-slate-400"> est.</span>}
        </span>
      );
    },
  }),
  helper.accessor('provider', {
    header: 'Source',
    cell: (info) => {
      const value = info.getValue();
      return value ? <span className="whitespace-nowrap">{capitalize(value)}</span> : dash;
    },
  }),
  helper.accessor('workplace', {
    header: 'Workplace',
    cell: (info) => {
      const value = info.getValue();
      if (!value) return dash;
      const tone: BadgeTone = value === 'HYBRID' ? 'blue' : 'red';
      return <Badge tone={tone}>{WORKPLACE_LABELS[value]}</Badge>;
    },
  }),
  helper.accessor('industry', {
    header: 'Industry',
    cell: (info) => {
      const value = info.getValue();
      return value ? (
        <Badge tone={toneFor(value)} title={value}>
          {value}
        </Badge>
      ) : (
        dash
      );
    },
  }),
  helper.display({
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusCell job={row.original} />,
  }),
  helper.display({
    id: 'hide',
    header: 'Actions',
    cell: ({ row }) => <HideCell job={row.original} />,
  }),
]);

/** How each column header sorts and filters. Columns not listed here do neither. */
export interface ColumnControls {
  sortField?: JobSortField;
  filter?: {
    key: ListFilterKey;
    options: (opts: JobFilterOptions | undefined) => { value: string; label: string }[];
  };
}

const plain = (values: string[] | undefined) => (values ?? []).map((v) => ({ value: v, label: v }));
const capitalized = (values: string[] | undefined) =>
  (values ?? []).map((v) => ({ value: v, label: capitalize(v) }));

export const COLUMN_CONTROLS: Record<string, ColumnControls> = {
  company: {
    sortField: 'COMPANY',
    filter: { key: 'companies', options: (o) => plain(o?.companies) },
  },
  postedAt: { sortField: 'POSTED_AT' },
  title: { sortField: 'TITLE' },
  jobFunction: { filter: { key: 'jobFunctions', options: (o) => plain(o?.jobFunctions) } },
  seniority: {
    sortField: 'SENIORITY',
    filter: { key: 'seniorities', options: (o) => capitalized(o?.seniorities) },
  },
  skills: { filter: { key: 'skills', options: (o) => plain(o?.skills) } },
  city: { sortField: 'CITY', filter: { key: 'cities', options: (o) => plain(o?.cities) } },
  salary: { sortField: 'SALARY' },
  provider: { filter: { key: 'providers', options: (o) => capitalized(o?.providers) } },
  workplace: {
    sortField: 'WORKPLACE',
    filter: {
      key: 'workplaces',
      options: () => WORKPLACES.map((w) => ({ value: w, label: WORKPLACE_LABELS[w] })),
    },
  },
  industry: { filter: { key: 'industries', options: (o) => plain(o?.industries) } },
  // Matches and statuses are per user (separate tables), so the server can't sort by them.
  status: {
    filter: {
      key: 'applicationStatuses',
      options: () => APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    },
  },
};
