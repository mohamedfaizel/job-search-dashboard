import type { Job, JobFilterOptions, JobSortField, ListFilterKey } from '@jobsearch/data';
import { APPLICATION_STATUSES, VISA_SPONSORSHIPS, WORKPLACES } from '@jobsearch/data';
import { columnVisibilityFeature, createColumnHelper, tableFeatures } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { createContext, useContext } from 'react';
import { capitalize } from '../format';
import type { JobFormat } from '../useJobFormat';
import { useJobFormat } from '../useJobFormat';
import type { BadgeTone } from './Badge';
import { Badge } from './Badge';
import { BookmarkIcon, ExternalLinkIcon, EyeIcon, EyeSlashIcon } from './icons';
import { scoreTone } from './MatchPanel';
import { StatusSelect } from './StatusSelect';
import { isExpired } from './StillOpen';

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
  /** Each queued job's number in your Apply queue, for its "Queue #2" badge. */
  queueNumbers?: ReadonlyMap<string, number> | undefined;
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

/** Every column name and filter name the table translates. */
export type ColumnNameKey =
  | 'title'
  | 'scores'
  | 'details'
  | 'fit'
  | 'apply'
  | 'match'
  | 'location'
  | 'postedAt'
  | 'salary'
  | 'visa'
  | 'skills'
  | 'seniority'
  | 'jobFunction'
  | 'language'
  | 'workplace'
  | 'industry'
  | 'provider'
  | 'status'
  | 'actions'
  | 'company'
  | 'city';

/**
 * A column's header in your language. Headers are components, not strings, because the
 * columns are defined once at module scope, before anyone has picked a language.
 */
function ColumnName({ id, srOnly = false }: { id: ColumnNameKey; srOnly?: boolean }) {
  const t = useTranslations('Jobs.columns');
  return srOnly ? <span className="sr-only">{t(id)}</span> : t(id);
}

function LanguageBadge({ code }: { code: string }) {
  const f = useJobFormat();
  return <Badge tone="purple">{f.language(code)}</Badge>;
}

function WorkplaceBadge({ workplace }: { workplace: NonNullable<Job['workplace']> }) {
  const f = useJobFormat();
  return <Badge tone={workplace === 'HYBRID' ? 'blue' : 'red'}>{f.workplace(workplace)}</Badge>;
}

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
function isNew(job: Job, newSince: string | null | undefined): boolean {
  return !!newSince && Date.parse(job.createdAt) > Date.parse(newSince);
}

/** Title (opens the popup) with the company under it: one cell instead of two columns. */
export function JobCell({ job }: { job: Job }) {
  const { openJob, newSince, queueNumbers } = useRowActions();
  const t = useTranslations('Jobs.row');
  const fresh = isNew(job, newSince);
  const queued = queueNumbers?.get(job.id);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CompanyLogo job={job} />
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => {
            openJob(job);
          }}
          className="block max-w-[22rem] cursor-pointer truncate rounded-sm text-left text-sm font-semibold text-slate-900 decoration-brand-400 decoration-2 underline-offset-4 transition-colors hover:text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          title={job.title}
        >
          {job.title}
        </button>
        <span className="flex max-w-[22rem] items-center gap-1.5 text-slate-500">
          {fresh && (
            <Badge tone="flag" title={t('newHint')}>
              {t('new')}
            </Badge>
          )}
          {isExpired(job) && (
            <Badge tone="red" title={t('expiredHint')}>
              {t('expired')}
            </Badge>
          )}
          {queued !== undefined && (
            <Badge tone="purple" title={t('queueHint', { n: queued })}>
              {t('queue', { n: queued })}
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
  const f = useJobFormat();
  const country = job.countryCode ? f.country(job.countryCode) : null;
  const top = job.city ?? country;
  const below = [job.city ? country : null, job.workplace && f.workplace(job.workplace)]
    .filter(Boolean)
    .join(' · ');
  if (!top && !below) return dash;
  return (
    <div className="whitespace-nowrap">
      <span className="block text-slate-700">{top ?? f.workplace('REMOTE')}</span>
      {below && top && <span className="block text-xs text-slate-500">{below}</span>}
    </div>
  );
}

export function PostedCell({ job }: { job: Job }) {
  const f = useJobFormat();
  return (
    <time
      dateTime={job.postedAt}
      title={f.date(job.postedAt)}
      className="whitespace-nowrap text-slate-500"
    >
      {f.timeAgo(job.postedAt)}
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
  const f = useJobFormat();
  if (visa === 'OFFERS') return <Badge tone="green">{f.visa('OFFERS')}</Badge>;
  if (visa === 'NO') return <Badge tone="gray">{f.visa('NO')}</Badge>;
  return hideUnknown ? null : dash;
}

export function SalaryCell({ job }: { job: Job }) {
  const f = useJobFormat();
  const t = useTranslations('Jobs.row');
  const salary = f.salary(job.salaryMinUsd, job.salaryMaxUsd);
  if (!salary) return dash;
  return (
    <span
      className="whitespace-nowrap text-slate-700 tabular-nums"
      title={job.salaryEstimated ? t('salaryEstimated') : t('salaryStated')}
    >
      {salary}
      {job.salaryEstimated && <span className="text-slate-400"> {t('estimated')}</span>}
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
  const f = useJobFormat();
  const t = useTranslations('Jobs.row');
  return (
    <StatusSelect
      label={t('statusFor', { job: f.jobName(job) })}
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
/** The small "Fit" / "Kit" / "AI" word in front of a score in the Scores column. */
function ScoreLabel({ text }: { text: string | undefined }) {
  return text ? <span className="mr-1 text-[10px] font-semibold opacity-70">{text}</span> : null;
}

export function FitCell({ job, labelled = false }: { job: Job; labelled?: boolean }) {
  const { openJob } = useRowActions();
  const t = useTranslations('Jobs.row');
  if (job.fitScore === null) {
    return <span title={t('fitEmpty')}>{dash}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => {
        openJob(job);
      }}
      aria-label={t('fitLabel', { title: job.title, score: job.fitScore })}
      title={t('fitHint')}
      className="rounded"
    >
      <Badge tone={scoreTone(job.fitScore)}>
        <ScoreLabel text={labelled ? t('fitShort') : undefined} />
        {job.fitScore}%
      </Badge>
    </button>
  );
}

/**
 * Apply kit score: the same score as Fit %, for the resume Claude wrote for this job. It shows
 * what the Apply kit gained, next to the Fit % of your own resume. Click for the popup.
 */
export function ApplyKitCell({ job, labelled = false }: { job: Job; labelled?: boolean }) {
  const { openJob } = useRowActions();
  const t = useTranslations('Jobs.row');
  if (job.applyScore === null) return <span title={t('applyEmpty')}>{dash}</span>;
  return (
    <button
      type="button"
      onClick={() => {
        openJob(job);
      }}
      aria-label={t('applyLabel', { title: job.title, score: job.applyScore })}
      title={t('applyHint')}
      className="rounded"
    >
      <Badge tone={scoreTone(job.applyScore)}>
        <ScoreLabel text={labelled ? t('applyShort') : undefined} />
        {job.applyScore}%
      </Badge>
    </button>
  );
}

/** Resume-Matcher's ATS score for the job; clicking it opens the popup with the breakdown. */
export function MatchCell({ job, labelled = false }: { job: Job; labelled?: boolean }) {
  const { openJob } = useRowActions();
  const t = useTranslations('Jobs.row');
  const { matchStatus, matchScore } = job;
  if (!matchStatus) return dash;
  const label =
    matchStatus === 'PENDING'
      ? t('matching')
      : matchStatus === 'FAILED' || matchScore === null
        ? t('matchFailed')
        : String(Math.round(matchScore));
  const tone: BadgeTone =
    matchStatus === 'READY' && matchScore !== null ? scoreTone(matchScore) : 'gray';
  return (
    <button
      type="button"
      onClick={() => {
        openJob(job);
      }}
      aria-label={t('matchLabel', { title: job.title, label })}
      title={t('matchHint')}
      className="rounded"
    >
      <Badge tone={tone}>
        <ScoreLabel text={labelled ? t('matchShort') : undefined} />
        {label}
      </Badge>
    </button>
  );
}

/**
 * Fit %, Apply kit % and the AI matcher's score, each with a short label. In the table Fit and Kit
 * share the first line and AI sits under them; phone cards keep all three on one line. Scores a
 * job doesn't have yet are left out.
 */
export function ScoresCell({ job, inline = false }: { job: Job; inline?: boolean }) {
  if (job.fitScore === null && job.applyScore === null && !job.matchStatus) {
    return <FitCell job={job} />;
  }
  return (
    <div className={inline ? 'flex items-center gap-1' : 'flex flex-col items-start gap-1'}>
      {(job.fitScore !== null || job.applyScore !== null) && (
        <div className="flex items-center gap-1">
          {job.fitScore !== null && <FitCell job={job} labelled />}
          {job.applyScore !== null && <ApplyKitCell job={job} labelled />}
        </div>
      )}
      {job.matchStatus && <MatchCell job={job} labelled />}
    </div>
  );
}

export function SeniorityBadge({ seniority }: { seniority: Job['seniority'] }) {
  const t = useTranslations('Jobs.columns');
  return seniority ? (
    <Badge tone="orange" title={t('seniority')}>
      {capitalize(seniority)}
    </Badge>
  ) : null;
}

/** Seniority and salary on one line, the ad's visa stance under them. */
export function DetailsCell({ job }: { job: Job }) {
  const hasSalary = job.salaryMinUsd !== null || job.salaryMaxUsd !== null;
  const hasVisa = job.visa === 'OFFERS' || job.visa === 'NO';
  if (!job.seniority && !hasSalary && !hasVisa) return dash;
  return (
    <div className="space-y-1">
      {(job.seniority || hasSalary) && (
        <div className="flex items-center gap-1.5">
          <SeniorityBadge seniority={job.seniority} />
          {hasSalary && <SalaryCell job={job} />}
        </div>
      )}
      {hasVisa && (
        <div>
          <VisaCell visa={job.visa} hideUnknown />
        </div>
      )}
    </div>
  );
}

export function SelectCell({ job }: { job: Job }) {
  const { selected, toggleSelected } = useRowActions();
  const f = useJobFormat();
  const t = useTranslations('Jobs.row');
  return (
    <input
      type="checkbox"
      aria-label={t('select', { job: f.jobName(job) })}
      checked={selected.has(job.id)}
      onChange={() => {
        toggleSelected(job);
      }}
      className="h-4 w-4 rounded border-slate-300 accent-brand-600"
    />
  );
}

function SelectAllHeader() {
  const { selected, toggleAll, allSelected } = useRowActions();
  const t = useTranslations('Jobs.row');
  return (
    <input
      type="checkbox"
      aria-label={t('selectAll')}
      checked={allSelected}
      // "Some but not all" shows a dash in the box.
      ref={(box) => {
        if (box) box.indeterminate = !allSelected && selected.size > 0;
      }}
      onChange={toggleAll}
      className="h-4 w-4 rounded border-slate-300 accent-brand-600"
    />
  );
}

const ICON_BUTTON =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent';

/**
 * Save (bookmark), Hide (crossed-out eye) and Open posting, as icon buttons with tooltips.
 * `withText` adds the words next to the icons, for the phone cards.
 */
export function ActionsCell({ job, withText = false }: { job: Job; withText?: boolean }) {
  const { setStatus, toggleHidden, showingHidden = false } = useRowActions();
  const f = useJobFormat();
  const t = useTranslations('Jobs.row');
  const name = f.jobName(job);
  const saved = job.applicationStatus === 'SAVED';
  // Applied, Interviewing and so on are already tracked, so there is nothing to save.
  const tracked = job.applicationStatus !== 'NONE' && !saved;
  const saveTip = tracked
    ? t('tracked', { status: f.status(job.applicationStatus) })
    : saved
      ? t('savedHint')
      : t('saveHint');
  const wide = withText ? 'w-auto gap-1.5 px-2 text-xs font-medium text-slate-600' : '';

  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        type="button"
        aria-label={t(saved ? 'unsaveLabel' : 'saveLabel', { job: name })}
        aria-pressed={saved || tracked}
        title={saveTip}
        disabled={tracked}
        onClick={() => {
          setStatus(job, saved ? 'NONE' : 'SAVED');
        }}
        className={`${ICON_BUTTON} ${wide} ${saved || tracked ? 'text-brand-600' : ''}`}
      >
        <BookmarkIcon filled={saved || tracked} />
        {withText && t(saved ? 'saved' : 'save')}
      </button>
      <button
        type="button"
        aria-label={t(showingHidden ? 'unhideLabel' : 'hideLabel', { job: name })}
        title={t(showingHidden ? 'unhideHint' : 'hideHint')}
        onClick={() => {
          toggleHidden(job);
        }}
        className={`${ICON_BUTTON} ${wide} hover:text-red-600`}
      >
        {showingHidden ? <EyeIcon /> : <EyeSlashIcon />}
        {withText && t(showingHidden ? 'unhide' : 'hide')}
      </button>
      {job.url ? (
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          aria-label={t('postingLabel', { job: name })}
          title={t('postingHint')}
          className={`${ICON_BUTTON} ${wide}`}
        >
          <ExternalLinkIcon />
          {withText && t('posting')}
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
    header: () => <ColumnName id="title" />,
    // Every row needs something to click to open the job, so this column can't be hidden.
    enableHiding: false,
    cell: ({ row }) => <JobCell job={row.original} />,
  }),
  // Next to the title, so the scores are visible without scrolling the wide table sideways.
  helper.display({
    id: 'scores',
    header: () => <ColumnName id="scores" />,
    cell: ({ row }) => <ScoresCell job={row.original} />,
  }),
  helper.display({
    id: 'location',
    header: () => <ColumnName id="location" />,
    cell: ({ row }) => <LocationCell job={row.original} />,
  }),
  helper.accessor('postedAt', {
    header: () => <ColumnName id="postedAt" />,
    cell: ({ row }) => <PostedCell job={row.original} />,
  }),
  helper.display({
    id: 'details',
    header: () => <ColumnName id="details" />,
    cell: ({ row }) => <DetailsCell job={row.original} />,
  }),
  helper.accessor('skills', {
    header: () => <ColumnName id="skills" />,
    cell: (info) => <SkillsCell skills={info.getValue()} />,
  }),
  helper.accessor('jobFunction', {
    header: () => <ColumnName id="jobFunction" />,
    cell: (info) => {
      const value = info.getValue();
      return value ? <Badge tone="red">{value}</Badge> : dash;
    },
  }),
  helper.accessor('language', {
    header: () => <ColumnName id="language" />,
    cell: (info) => {
      const value = info.getValue();
      return value ? <LanguageBadge code={value} /> : dash;
    },
  }),
  helper.accessor('workplace', {
    header: () => <ColumnName id="workplace" />,
    cell: (info) => {
      const value = info.getValue();
      if (!value) return dash;
      return <WorkplaceBadge workplace={value} />;
    },
  }),
  helper.accessor('industry', {
    header: () => <ColumnName id="industry" />,
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
    header: () => <ColumnName id="provider" />,
    cell: (info) => {
      const value = info.getValue();
      return value ? <span className="whitespace-nowrap">{capitalize(value)}</span> : dash;
    },
  }),
  helper.display({
    id: 'status',
    header: () => <ColumnName id="status" />,
    cell: ({ row }) => <StatusCell job={row.original} />,
  }),
  helper.display({
    id: 'actions',
    header: () => <ColumnName id="actions" srOnly />,
    enableHiding: false,
    cell: ({ row }) => <ActionsCell job={row.original} />,
  }),
]);

/**
 * Columns that start switched off, so the table shows only what you decide on at a glance. They
 * stay in the Columns menu, so you can turn them back on.
 */
export const DEFAULT_HIDDEN_COLUMNS = [
  'skills',
  'jobFunction',
  'language',
  'workplace',
  'industry',
  'provider',
];

/**
 * Every column for the Columns menu, in table order. The tick boxes and the action icons always
 * show, so they aren't listed.
 */
export const MENU_COLUMNS = columns.flatMap((column) => {
  // Accessor columns take their id from the field they read.
  const id = column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '');
  if (id === 'select' || id === 'actions') return [];
  return [{ id: id as ColumnNameKey, canHide: column.enableHiding !== false }];
});

/** How each column header sorts and filters. Columns not listed here do neither. */
export interface ColumnControls {
  sortField?: JobSortField;
  filter?: ColumnFilterControl;
  /** Several filters in one funnel, each with its own titled list (Details: Seniority and Visa). */
  filters?: (ColumnFilterControl & { name: ColumnNameKey })[];
}

export interface ColumnFilterControl {
  key: ListFilterKey;
  /** What the filter picks, when it isn't the column's name: the Job column filters companies. */
  name?: ColumnNameKey;
  options: (
    opts: JobFilterOptions | undefined,
    format: JobFormat,
  ) => { value: string; label: string }[];
}

const plain = (values: string[] | undefined) => (values ?? []).map((v) => ({ value: v, label: v }));
const capitalized = (values: string[] | undefined) =>
  (values ?? []).map((v) => ({ value: v, label: capitalize(v) }));

export const COLUMN_CONTROLS: Record<string, ColumnControls> = {
  title: {
    sortField: 'TITLE',
    filter: { key: 'companies', name: 'company', options: (o) => plain(o?.companies) },
  },
  location: {
    sortField: 'CITY',
    filter: { key: 'cities', name: 'city', options: (o) => plain(o?.cities) },
  },
  scores: { sortField: 'FIT' },
  postedAt: { sortField: 'POSTED_AT' },
  jobFunction: { filter: { key: 'jobFunctions', options: (o) => plain(o?.jobFunctions) } },
  skills: { filter: { key: 'skills', options: (o) => plain(o?.skills) } },
  language: {
    filter: {
      key: 'languages',
      options: (o, f) => (o?.languages ?? []).map((v) => ({ value: v, label: f.language(v) })),
    },
  },
  // Sorts by salary; the funnel filters seniority and visa.
  details: {
    sortField: 'SALARY',
    filters: [
      { key: 'seniorities', name: 'seniority', options: (o) => capitalized(o?.seniorities) },
      {
        key: 'visas',
        name: 'visa',
        options: (_, f) => VISA_SPONSORSHIPS.map((v) => ({ value: v, label: f.visa(v) })),
      },
    ],
  },
  provider: { filter: { key: 'providers', options: (o) => capitalized(o?.providers) } },
  workplace: {
    sortField: 'WORKPLACE',
    filter: {
      key: 'workplaces',
      options: (_, f) => WORKPLACES.map((w) => ({ value: w, label: f.workplace(w) })),
    },
  },
  industry: { filter: { key: 'industries', options: (o) => plain(o?.industries) } },
  // Statuses are per user (a separate table), so the server doesn't sort by them.
  status: {
    filter: {
      key: 'applicationStatuses',
      options: (_, f) => APPLICATION_STATUSES.map((s) => ({ value: s, label: f.status(s) })),
    },
  },
};
