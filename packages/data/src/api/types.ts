// TypeScript mirrors of the GraphQL schema (apps/api/schema.gql).

export const WORKPLACES = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
export type Workplace = (typeof WORKPLACES)[number];

/** What a job ad says about visa sponsorship or relocation help. */
export const VISA_SPONSORSHIPS = ['OFFERS', 'NO', 'NOT_STATED'] as const;
export type VisaSponsorship = (typeof VISA_SPONSORSHIPS)[number];

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
  'POSTED_AT' | 'TITLE' | 'COMPANY' | 'SENIORITY' | 'CITY' | 'SALARY' | 'WORKPLACE' | 'FIT';

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
  /** Read from the description; null for a job the API hasn't checked yet. */
  visa: VisaSponsorship | null;
  industry: string | null;
  description: string | null;
  postingStatus: string;
  applicationStatus: ApplicationStatus;
  /** Your resume match for this job, if you asked for one. */
  matchStatus: JobMatchStatus | null;
  /** Resume-Matcher's ATS score (0-100). Null until the match is READY. */
  matchScore: number | null;
  /**
   * Fit %: how well your profile resume covers the job's skills, keywords and title (0-100),
   * the same score as in the popup. No AI. Null until you add a resume.
   */
  fitScore: number | null;
  /** When the job was imported or added: after your last visit, it is New. */
  createdAt: string;
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
  visas?: VisaSponsorship[];
  applicationStatuses?: ApplicationStatus[];
  minSalaryUsd?: number;
  /** ISO date-time: only jobs imported or added after it (the New chip). */
  createdAfter?: string;
  /** Only jobs whose Fit % is at least this. */
  minFit?: number;
  /** ISO date-time: only jobs posted after it. */
  postedAfter?: string;
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

/** The job types the import can filter on (JobsPipe's employment_type_or). */
export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'internship'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export interface SyncJobsInput {
  titles: string[];
  skills?: string[];
  countryCodes?: string[];
  /** Cities or regions, e.g. ["Berlin", "Bavaria"]. */
  locations?: string[];
  /** Languages the posting is written in, ISO 639-1, e.g. ["en", "de"]. */
  languages?: string[];
  /** Skip postings that ask for fluent German. */
  skipFluentGerman?: boolean;
  remoteOnly?: boolean;
  /** Skip postings whose title contains any of these. */
  excludeTitles?: string[];
  employmentTypes?: EmploymentType[];
  /** Euros a year; postings without a posted salary never match. */
  minSalaryEur?: number | null;
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
  languages: string[];
  skipFluentGerman: boolean;
  remoteOnly: boolean;
  excludeTitles: string[];
  employmentTypes: EmploymentType[];
  minSalaryEur: number | null;
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
  /** Languages with your real level, e.g. "German A2". */
  languages: string[];
  yearsExperience: number | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  resumeText: string;
  resumeFileName: string | null;
  /** The language the master resume is written in (ISO 639-1), e.g. "en". */
  resumeLanguage: string;
  /** The master resume in other languages, used for jobs in those languages. */
  otherResumes: LanguageResume[];
  // Application answers: what every application form asks for. Empty when not given.
  phone: string;
  address: string;
  workPermit: string;
  noticePeriod: string;
  salaryExpectation: string;
  relocation: string;
  /** Short answers you reuse on applications, as free text. */
  applicationNotes: string;
  /** Null until the profile is first saved. */
  updatedAt: string | null;
}

/** Your master resume in another language, e.g. German next to the English one. */
export interface LanguageResume {
  language: string;
  text: string;
  /** The uploaded file, null when pasted. */
  fileName: string | null;
  updatedAt: string;
}

export type ProfileInput = Omit<Profile, 'resumeFileName' | 'otherResumes' | 'updatedAt'>;

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

/** A skill tag or keyword, and whether your resume mentions it. */
export interface TermCheck {
  term: string;
  inResume: boolean;
  /** Not in the resume text, but on the Skills list of My profile ("I have this"). Counts as covered. */
  youHave: boolean;
  /** For a missing term: the skill you have that it goes with, e.g. "graphql" for "apollo". */
  relatedTo: string | null;
}

/** What a job asks for, worked out without AI and checked against your resume. */
export interface JobInsights {
  jobId: string;
  title: string;
  /** JobsPipe's cleaned-up title, when it differs from the posted one. */
  normalizedTitle: string | null;
  /** ISO 639-1 code, e.g. "de". */
  language: string | null;
  /** True when the language was guessed from the text. */
  languageDetected: boolean;
  /** The ad is written in German or asks for German skills (not just as a plus). */
  germanRequired: boolean;
  /** The German level the ad names, e.g. "B2". */
  germanLevel: string | null;
  /** The language the prompt asks for: "de" when German is required, else "en". */
  resumeLanguage: string;
  /** The language of the master resume this job was checked against. */
  checkedAgainst: string;
  hasResume: boolean;
  skills: TermCheck[];
  keywords: TermCheck[];
  /** Skills and keywords you removed with ×. */
  removed: RemovedTerm[];
  /** Percent of the skills in your resume. Null without a resume. */
  skillsCoverage: number | null;
  keywordsCoverage: number | null;
  /** How well your resume names the job title (100 = the whole title appears). */
  titleMatch: number | null;
  /**
   * Our own score, weighted like Resume-Matcher's: keywords 40%, skills 20%, title 15%,
   * sections 15% and dates 10% (both always full).
   */
  score: number | null;
  /** The resume you wrote for this job, if you uploaded or pasted one. */
  jobResume: JobResume | null;
  /** The Apply kit prompt: paste into Claude for the resume, cover letter and form answers. */
  prompt: string;
}

/** The resume you wrote for one job, scored the same way as your profile resume. */
export interface JobResume {
  /** Name of the uploaded file. Null when the text was pasted. */
  fileName: string | null;
  /** From the Apply kit reply. Empty when there was none. */
  coverLetter: string;
  formAnswers: string;
  updatedAt: string;
  skillsCoverage: number | null;
  keywordsCoverage: number | null;
  titleMatch: number | null;
  /** The "after" score. The job's `score` is the "before". */
  score: number | null;
  /** Skills and keywords it has and your profile resume doesn't. */
  nowCovered: string[];
  /** Skills and keywords still missing. */
  stillMissing: string[];
}

export interface RemovedTerm {
  term: string;
  /** Removed from every job, not just this one. */
  everywhere: boolean;
}

/** A job you lined up to apply for. */
/** One Claude prompt that writes the replies for several queued jobs at once. */
export interface ApplyQueuePrompt {
  /** Empty when every queued job already has a reply. */
  prompt: string;
  /** The jobs in this prompt (at most 5), oldest first. */
  jobIds: string[];
  /** Queued jobs with no reply yet, in this prompt or not. */
  waiting: number;
}

export interface ApplyQueueItem {
  jobId: string;
  title: string;
  company: string;
  url: string | null;
  /** True once Claude's reply (resume, cover letter, form answers) is saved for the job. */
  ready: boolean;
  addedAt: string;
}
