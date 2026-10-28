// TypeScript mirrors of the GraphQL schema (apps/api/schema.gql).

export const WORKPLACES = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
export type Workplace = (typeof WORKPLACES)[number];

export const APPLICATION_STATUSES = [
  'NONE',
  'SAVED',
  'APPLIED',
  'INTERVIEWING',
  'OFFER',
  'REJECTED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type JobSource = 'JOBSPIPE' | 'MANUAL';

export type JobSortField =
  'POSTED_AT' | 'TITLE' | 'COMPANY' | 'SENIORITY' | 'CITY' | 'SALARY' | 'WORKPLACE';

export type SortDirection = 'ASC' | 'DESC';

export interface Company {
  id: number;
  name: string;
  logoUrl: string | null;
}

export interface Job {
  id: string;
  source: JobSource;
  title: string;
  company: Company;
  url: string | null;
  postedAt: string;
  seniority: string | null;
  jobFunction: string | null;
  skills: string[];
  city: string | null;
  countryCode: string | null;
  /** ISO 639-1 code of the posting's language, e.g. "de". */
  language: string | null;
  salaryMinUsd: number | null;
  salaryMaxUsd: number | null;
  salaryEstimated: boolean;
  provider: string | null;
  workplace: Workplace | null;
  industry: string | null;
  description: string | null;
  postingStatus: string;
  applicationStatus: ApplicationStatus;
  /** Your resume match for this job, if you asked for one. */
  matchStatus: JobMatchStatus | null;
  /** Resume-Matcher's ATS score (0-100). Null until the match is READY. */
  matchScore: number | null;
}

/** A job on your tracker board: any status except NONE. */
export interface Application {
  status: ApplicationStatus;
  /** When the status last changed. */
  updatedAt: string;
  job: Job;
}

export interface JobFilterInput {
  search?: string;
  companies?: string[];
  seniorities?: string[];
  jobFunctions?: string[];
  skills?: string[];
  cities?: string[];
  countryCodes?: string[];
  languages?: string[];
  providers?: string[];
  industries?: string[];
  workplaces?: Workplace[];
  applicationStatuses?: ApplicationStatus[];
  minSalaryUsd?: number;
  /** True lists only the jobs you hid; otherwise they are left out. */
  hidden?: boolean;
}

export interface JobSortInput {
  field: JobSortField;
  direction: SortDirection;
}

export interface JobsPageArgs {
  filter?: JobFilterInput;
  sort?: JobSortInput;
  page: number;
  pageSize: number;
}

export interface JobsPage {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JobFilterOptions {
  companies: string[];
  seniorities: string[];
  jobFunctions: string[];
  skills: string[];
  cities: string[];
  countryCodes: string[];
  languages: string[];
  providers: string[];
  industries: string[];
}

export interface CreateJobInput {
  title: string;
  companyName: string;
  url?: string;
  seniority?: string;
  jobFunction?: string;
  skills?: string[];
  city?: string;
  countryCode?: string;
  salaryMinUsd?: number;
  salaryMaxUsd?: number;
  workplace?: Workplace;
  industry?: string;
  description?: string;
  applicationStatus?: ApplicationStatus;
}

export interface SyncJobsInput {
  titles: string[];
  skills?: string[];
  countryCodes?: string[];
  /** Cities or regions, e.g. ["Berlin", "Bavaria"]. */
  locations?: string[];
  maxAgeDays?: number;
  pageSize?: number;
  maxPages?: number;
  /** Only postings found since the last complete run of this search. Default true. */
  onlyNew?: boolean;
  /** Continue the last import of this search from where it stopped. */
  resume?: boolean;
}

export interface SyncJobsResult {
  pages: number;
  fetched: number;
  created: number;
  updated: number;
  totalAvailable: number | null;
  hasMore: boolean;
  creditsRemaining: number | null;
  creditsCharged: number;
  jobsAlreadyPaid: number;
  /** ISO date-time the incremental run started from, or null on a first/full run. */
  newSince: string | null;
  resumed: boolean;
}

/** A search to save: a name plus the import fields (everything but `resume`). */
export interface SavedSearchInput extends Omit<SyncJobsInput, 'resume'> {
  name: string;
}

/** One finished import, as the history table shows it. */
export interface SyncRun {
  id: number;
  startedAt: string;
  finishedAt: string;
  complete: boolean;
  fetched: number;
  created: number;
  updated: number;
  creditsCharged: number | null;
  jobsAlreadyPaid: number | null;
  savedSearchId: number | null;
  savedSearchName: string | null;
  /** True when the scheduler started it. */
  scheduled: boolean;
  /** e.g. "frontend · DE · Berlin" */
  summary: string;
}

export interface SavedSearch {
  id: number;
  name: string;
  titles: string[];
  skills: string[];
  countryCodes: string[];
  locations: string[];
  maxAgeDays: number;
  pageSize: number;
  maxPages: number;
  onlyNew: boolean;
  schedule: ScheduleFrequency;
  /** "HH:mm" in the API server's local time. */
  runAt: string;
  nextRunAt: string | null;
  /** What happened at the last scheduled time (ran, skipped for credits, failed). */
  scheduleNote: string | null;
  createdAt: string;
  lastRun: SyncRun | null;
}

export const SCHEDULE_FREQUENCIES = ['OFF', 'HOURLY', 'DAILY', 'WEEKDAYS'] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export interface ImportBudget {
  /** Credits used by every import since midnight (server time). */
  used: number;
  /** DAILY_CREDIT_CAP: scheduled runs stop before going over it. */
  cap: number;
}

export type Role = 'ADMIN' | 'USER';

export interface User {
  id: number;
  email: string;
  name: string;
  /** ADMIN can import jobs and manage saved searches; the first account to sign up gets it. */
  role: Role;
}

export interface LogInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends LogInInput {
  name: string;
}

/** What the user tells us about themselves, plus the text of their master resume. */
export interface Profile {
  headline: string;
  targetRoles: string[];
  locations: string[];
  skills: string[];
  yearsExperience: number | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  resumeText: string;
  resumeFileName: string | null;
  /** Null until the profile is first saved. */
  updatedAt: string | null;
}

export type ProfileInput = Omit<Profile, 'resumeFileName' | 'updatedAt'>;

/** Whether Resume-Matcher (resume tailoring and ATS scores) is running and can reach its AI. */
export interface ResumeMatcherStatus {
  /** False when RESUME_MATCHER_URL is not set on the server. */
  configured: boolean;
  reachable: boolean;
  /** Null unless the AI check was asked for. */
  aiConfigured: boolean | null;
  aiHealthy: boolean | null;
  /** The provider and model Resume-Matcher really uses; its own Settings page beats .env. */
  aiProvider: string | null;
  aiModel: string | null;
  message: string;
}

export type MatcherResumeState = 'NO_FILE' | 'NOT_SENT' | 'OUTDATED' | 'READY' | 'FAILED';

/** Your master resume's copy in Resume-Matcher, which jobs are matched against. */
export interface MatcherResume {
  state: MatcherResumeState;
  /** The file Resume-Matcher last received. */
  fileName: string | null;
  syncedAt: string | null;
  message: string;
}

export type JobMatchStatus = 'PENDING' | 'READY' | 'FAILED';

/**
 * How well your master resume fits one job. Resume-Matcher lightly tailors the resume to the
 * job, then scores it the way an ATS would. All scores are 0-100.
 */
export interface JobMatch {
  jobId: string;
  status: JobMatchStatus;
  /** What went wrong. Null unless FAILED. */
  error: string | null;
  /** Weighted mix of the five scores below. */
  score: number | null;
  /** Share of the job's keywords already in your resume, before tailoring. */
  keywordMatchBefore: number | null;
  keywordMatch: number | null;
  skillsCoverage: number | null;
  /** Null when the posting has no clear job title. */
  titleMatch: number | null;
  sectionCompleteness: number | null;
  /** Null when the resume has fewer than two dates. */
  dateConsistency: number | null;
  missingKeywords: string[];
  injectableKeywords: string[];
  recommendations: string[];
  resumeFileName: string | null;
  startedAt: string;
  finishedAt: string | null;
  /** You sent a newer resume since this score. */
  outdated: boolean;
}

/** Your resume rewritten by Resume-Matcher for one job, with a cover letter. */
export interface TailoredResume {
  jobId: string;
  status: JobMatchStatus;
  /** What went wrong. Null unless FAILED. */
  error: string | null;
  /** ATS score of the tailored version (0-100). */
  score: number | null;
  /** Null if the cover letter could not be written. */
  coverLetter: string | null;
  resumeFileName: string | null;
  startedAt: string;
  finishedAt: string | null;
  /** You sent a newer resume since. */
  outdated: boolean;
}
