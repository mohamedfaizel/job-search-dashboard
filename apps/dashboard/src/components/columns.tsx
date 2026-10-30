import type { Job, JobFilterOptions, JobSortField, ListFilterKey } from '@jobsearch/data';
import { APPLICATION_STATUSES, VISA_SPONSORSHIPS, WORKPLACES } from '@jobsearch/data';
import { columnVisibilityFeature, createColumnHelper, tableFeatures } from '@tanstack/react-table';
import { createContext, useContext } from 'react';
import {
  capitalize,
  countryName,
  formatDate,
  formatSalary,
  languageName,
  STATUS_LABELS,
  timeAgo,
  VISA_LABELS,
  WORKPLACE_LABELS,
} from '../format';
import type { BadgeTone } from './Badge';
import { Badge } from './Badge';
import { BookmarkIcon, ExternalLinkIcon, EyeIcon, EyeSlashIcon } from './icons';
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
  /** Jobs imported after this get a New badge; null shows none. */
  newSince?: string | null;
}

/** The ticked rows, for actions on several jobs at once. */
export interface RowSelection {
  selected: ReadonlySet<string>;
  toggleSelected: (job: Job) => void;
  /** Ticks every job on this page, or unticks them all when they are all ticked. */
  toggleAll: () => void;
  allSelected: boolean;
}

export const RowActionsContext = createContext<(RowActions & RowSelection) | null>(null);
function useRowActions(): RowActions & RowSelection {
  const actions = useContext(RowActionsContext);
  if (!actions) throw new Error('RowActionsContext is missing');
  return actions;
}

// Sorting, filtering and paging all happen on the server, so the table only needs its core
// features plus column visibility (the Columns menu). Defined once at module scope, as
// TanStack Table recommends.
export const features = tableFeatures({ columnVisibilityFeature });
const helper = createColumnHelper<typeof features, Job>();

const INDUSTRY_TONES: BadgeTone[] = ['green', 'purple', 'pink', 'blue', 'orange', 'red'];
function toneFor(text: string): BadgeTone {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return INDUSTRY_TONES[Math.abs(hash) % INDUSTRY_TONES.length] ?? 'gray';
}

/** "at Acme" names in labels, so a screen reader knows which row a button belongs to. */
const jobName = (job: Job) => `${job.title} at ${job.company.name}`;

function CompanyLogo({ job }: { job: Job }) {
  const { name, logoUrl } = job.company;
  return logoUrl ? (
    <img
      src={logoUrl}
      alt=""
      className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white object-contain"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-500"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Imported or added after your last visit. */
export function isNew(job: Job, newSince: string | null | undefined): boolean {
  return !!newSince && Date.parse(job.createdAt) > Date.parse(newSince);
}

/** Title (opens the popup) with the company under it: one cell instead of two columns. */
export function JobCell({ job }: { job: Job }) {
  const { openJob, newSince } = useRowActions();
  const fresh = isNew(job, newSince);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CompanyLogo job={job} />
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => {
            openJob(job);
          }}
          className="block max-w-[22rem] truncate text-left text-sm font-semibold text-slate-900 hover:text-indigo-700"
          title={job.title}
        >
          {job.title}
        </button>
        <span className="flex max-w-[22rem] items-center gap-1.5 text-slate-500">
          {fresh && (
            <Badge tone="blue" title="Imported since your last visit">
              New
            </Badge>
          )}
          <span className="truncate" title={job.company.name}>
            {job.company.name}
          </span>
        </span>
      </div>
    </div>
  );
}

/** City on top; country and Remote/Hybrid under it. */
export function LocationCell({ job }: { job: Job }) {
  const country = job.countryCode ? countryName(job.countryCode) : null;
  const top = job.city ?? country;
  const below = [job.city ? country : null, job.workplace && WORKPLACE_LABELS[job.workplace]]
    .filter(Boolean)
    .join(' · ');
  if (!top && !below) return dash;
  return (
    <div className="whitespace-nowrap">
      <span className="block text-slate-700">{top ?? WORKPLACE_LABELS.REMOTE}</span>
      {below && top && <span className="block text-xs text-slate-500">{below}</span>}
    </div>
  );
}

export function PostedCell({ job }: { job: Job }) {
  return (
    <time
      dateTime={job.postedAt}
      title={formatDate(job.postedAt)}
      className="whitespace-nowrap text-slate-500"
    >
      {timeAgo(job.postedAt)}
    </time>
  );
}

/**
 * What the ad says about visa sponsorship, read from its text: a green badge when it offers help
 * (visa, Blue Card, relocation), a grey one when it rules sponsorship out.
 */
export function VisaCell({
  visa,
  hideUnknown = false,
}: {
  visa: Job['visa'];
  hideUnknown?: boolean;
}) {
  if (visa === 'OFFERS') return <Badge tone="green">{VISA_LABELS.OFFERS}</Badge>;
  if (visa === 'NO') return <Badge tone="gray">{VISA_LABELS.NO}</Badge>;
  return hideUnknown ? null : dash;
}

export function SalaryCell({ job }: { job: Job }) {
  const salary = formatSalary(job.salaryMinUsd, job.salaryMaxUsd);
  if (!salary) return dash;
  return (
    <span
      className="whitespace-nowrap text-slate-700 tabular-nums"
      title={job.salaryEstimated ? 'Estimated by JobsPipe' : 'Stated in the posting'}
    >
      {salary}
      {job.salaryEstimated && <span className="text-slate-400"> est.</span>}
    </span>
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

export function StatusCell({ job }: { job: Job }) {
  const { setStatus } = useRowActions();
  return (
    <StatusSelect
      label={`Status for ${jobName(job)}`}
      value={job.applicationStatus}
      onChange={(status) => {
        setStatus(job, status);
      }}
    />
  );
}

/**
 * Fit %: how much of the job's skills, keywords and title your profile resume covers, the same
 * score as in the popup. Clicking it opens the popup with the breakdown.
 */
export function FitCell({ job }: { job: Job }) {
  const { openJob } = useRowActions();
  if (job.fitScore === null) {
    return (
      <span title="Add your resume on My profile to see how well you fit each job">{dash}</span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        openJob(job);
      }}
      aria-label={`Fit for ${job.title}: ${String(job.fitScore)}%`}
      title="How much of the job's skills, keywords and title your resume covers. Click for details"
      className="rounded"
    >
      <Badge tone={scoreTone(job.fitScore)}>{job.fitScore}%</Badge>
    </button>
  );
}

/** Resume-Matcher's ATS score for the job; clicking it opens the popup with the breakdown. */
export function MatchCell({ job }: { job: Job }) {
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

export function SelectCell({ job }: { job: Job }) {
  const { selected, toggleSelected } = useRowActions();
  return (
    <input
      type="checkbox"
      aria-label={`Select ${jobName(job)}`}
      checked={selected.has(job.id)}
      onChange={() => {
        toggleSelected(job);
      }}
      className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
    />
  );
}

function SelectAllHeader() {
  const { selected, toggleAll, allSelected } = useRowActions();
  return (
    <input
      type="checkbox"
      aria-label="Select all jobs on this page"
      checked={allSelected}
      // "Some but not all" shows a dash in the box.
      ref={(box) => {
        if (box) box.indeterminate = !allSelected && selected.size > 0;
      }}
      onChange={toggleAll}
      className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
    />
  );
}

const ICON_BUTTON =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent';

/**
 * Save (bookmark), Hide (crossed-out eye) and Open posting, as icon buttons with tooltips.
 * `withText` adds the words next to the icons, for the phone cards.
 */
export function ActionsCell({ job, withText = false }: { job: Job; withText?: boolean }) {
  const { setStatus, toggleHidden, showingHidden = false } = useRowActions();
  const saved = job.applicationStatus === 'SAVED';
  // Applied, Interviewing and so on are already tracked, so there is nothing to save.
  const tracked = job.applicationStatus !== 'NONE' && !saved;
  const saveTip = tracked
    ? `Already on your tracker (${STATUS_LABELS[job.applicationStatus]})`
    : saved
      ? 'Saved. Click to unsave'
      : 'Save to your tracker';
  const hideAction = showingHidden ? 'Unhide' : 'Hide';
  const wide = withText ? 'w-auto gap-1.5 px-2 text-xs font-medium text-slate-600' : '';

  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        type="button"
        aria-label={`${saved ? 'Unsave' : 'Save'} ${jobName(job)}`}
        aria-pressed={saved || tracked}
        title={saveTip}
        disabled={tracked}
        onClick={() => {
          setStatus(job, saved ? 'NONE' : 'SAVED');
        }}
        className={`${ICON_BUTTON} ${wide} ${saved || tracked ? 'text-indigo-600' : ''}`}
      >
        <BookmarkIcon filled={saved || tracked} />
        {withText && (saved ? 'Saved' : 'Save')}
      </button>
      <button
        type="button"
        aria-label={`${hideAction} ${jobName(job)}`}
        title={showingHidden ? 'Put back in your table' : 'Hide from your table'}
        onClick={() => {
          toggleHidden(job);
        }}
        className={`${ICON_BUTTON} ${wide} hover:text-red-600`}
      >
        {showingHidden ? <EyeIcon /> : <EyeSlashIcon />}
        {withText && hideAction}
      </button>
      {job.url ? (
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open posting for ${jobName(job)}`}
          title="Open the original posting"
          className={`${ICON_BUTTON} ${wide}`}
        >
          <ExternalLinkIcon />
          {withText && 'Posting'}
        </a>
      ) : (
        // Keeps the icons lined up in rows without a link.
        !withText && <span aria-hidden="true" className="inline-block w-8" />
      )}
    </div>
  );
}

export const columns = helper.columns([
  helper.display({
    id: 'select',
    header: () => <SelectAllHeader />,
    enableHiding: false,
    cell: ({ row }) => <SelectCell job={row.original} />,
  }),
  helper.display({
    id: 'title',
    header: 'Job',
    // Every row needs something to click to open the job, so this column can't be hidden.
    enableHiding: false,
    cell: ({ row }) => <JobCell job={row.original} />,
  }),
  // Next to the title, so the score is visible without scrolling the wide table sideways.
  helper.display({
    id: 'fit',
    header: 'Fit',
    cell: ({ row }) => <FitCell job={row.original} />,
  }),
  // Resume-Matcher's score needs AI and one run per job, so it starts hidden (Columns menu).
  helper.display({
    id: 'match',
    header: 'Match',
    cell: ({ row }) => <MatchCell job={row.original} />,
  }),
  helper.display({
    id: 'location',
    header: 'Location',
    cell: ({ row }) => <LocationCell job={row.original} />,
  }),
  helper.accessor('postedAt', {
    header: 'Posted',
    cell: ({ row }) => <PostedCell job={row.original} />,
  }),
  helper.display({
    id: 'salary',
    header: 'Salary',
    cell: ({ row }) => <SalaryCell job={row.original} />,
  }),
  helper.accessor('visa', {
    header: 'Visa',
    cell: (info) => <VisaCell visa={info.getValue()} />,
  }),
  helper.accessor('skills', {
    header: 'Skills',
    cell: (info) => <SkillsCell skills={info.getValue()} />,
  }),
  helper.accessor('seniority', {
    header: 'Seniority',
    cell: (info) => {
      const value = info.getValue();
      return value ? <Badge tone="orange">{capitalize(value)}</Badge> : dash;
    },
  }),
  helper.accessor('jobFunction', {
    header: 'Function',
    cell: (info) => {
      const value = info.getValue();
      return value ? <Badge tone="red">{value}</Badge> : dash;
    },
  }),
  helper.accessor('language', {
    header: 'Language',
    cell: (info) => {
      const value = info.getValue();
      return value ? <Badge tone="purple">{languageName(value)}</Badge> : dash;
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
  helper.accessor('provider', {
    header: 'Source',
    cell: (info) => {
      const value = info.getValue();
      return value ? <span className="whitespace-nowrap">{capitalize(value)}</span> : dash;
    },
  }),
  helper.display({
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusCell job={row.original} />,
  }),
  helper.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    enableHiding: false,
    cell: ({ row }) => <ActionsCell job={row.original} />,
  }),
]);

/**
 * Columns that start switched off, so the table shows only what you decide on at a glance. They
 * stay in the Columns menu, so you can turn them back on.
 */
export const DEFAULT_HIDDEN_COLUMNS = [
  'match',
  'skills',
  'seniority',
  'jobFunction',
  'language',
  'workplace',
  'industry',
  'provider',
];

/** How each column header sorts and filters. Columns not listed here do neither. */
export interface ColumnControls {
  sortField?: JobSortField;
  filter?: {
    key: ListFilterKey;
    /** What the filter picks, when it isn't the column's name: the Job column filters companies. */
    label?: string;
    options: (opts: JobFilterOptions | undefined) => { value: string; label: string }[];
  };
}

const plain = (values: string[] | undefined) => (values ?? []).map((v) => ({ value: v, label: v }));
const capitalized = (values: string[] | undefined) =>
  (values ?? []).map((v) => ({ value: v, label: capitalize(v) }));

export const COLUMN_CONTROLS: Record<string, ColumnControls> = {
  title: {
    sortField: 'TITLE',
    filter: { key: 'companies', label: 'Company', options: (o) => plain(o?.companies) },
  },
  location: {
    sortField: 'CITY',
    filter: { key: 'cities', label: 'City', options: (o) => plain(o?.cities) },
  },
  fit: { sortField: 'FIT' },
  postedAt: { sortField: 'POSTED_AT' },
  jobFunction: { filter: { key: 'jobFunctions', options: (o) => plain(o?.jobFunctions) } },
  seniority: {
    sortField: 'SENIORITY',
    filter: { key: 'seniorities', options: (o) => capitalized(o?.seniorities) },
  },
  skills: { filter: { key: 'skills', options: (o) => plain(o?.skills) } },
  language: {
    filter: {
      key: 'languages',
      options: (o) => (o?.languages ?? []).map((v) => ({ value: v, label: languageName(v) })),
    },
  },
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
  visa: {
    filter: {
      key: 'visas',
      options: () => VISA_SPONSORSHIPS.map((v) => ({ value: v, label: VISA_LABELS[v] })),
    },
  },
  // Statuses are per user (a separate table), so the server doesn't sort by them.
  status: {
    filter: {
      key: 'applicationStatuses',
      options: () => APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    },
  },
};
