// TypeScript mirrors of the GraphQL schema (apps/api/schema.gql).

export const WORKPLACES = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
export type Workplace = (typeof WORKPLACES)[number];

/** What a job ad says about visa sponsorship or relocation help. */
export const VISA_SPONSORSHIPS = ['OFFERS', 'NO', 'NOT_STATED'] as const;
export type VisaSponsorship = (typeof VISA_SPONSORSHIPS)[number];

/** What the still-open check found: UNKNOWN when the site blocked it or gave no clear answer. */
export type PostingCheck = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export const APPLICATION_STATUSES = [
  'NONE',
  'SAVED',
  'APPLIED',
  'INTERVIEWING',
  'OFFER',
  'REJECTED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type JobSource = 'JOBHUNTER' | 'MANUAL' | 'ARBEITSAGENTUR' | 'COMPANY_BOARD';

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
  /** "active", "closed" (JobHunter says so) or "expired" (our still-open check found it closed). */
  postingStatus: string;
  /** When the still-open check last opened the job's link. Null until it has been checked. */
  checkedAt: string | null;
  lastCheck: PostingCheck | null;
  /** Why, as a code: LOOKS_OPEN, NOT_FOUND, SAYS_CLOSED, REDIRECTED, BLOCKED, TIMEOUT… */
  checkReason: string | null;
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
  /** Apply kit score (0-100): the Fit % of the resume Claude wrote for this job. Null until a reply is saved. */
  applyScore: number | null;
  /** When the job was imported or added: after your last visit, it is New. */
  createdAt: string;
}

/** A job on your tracker board: any status except NONE. */
export interface Application {
  status: ApplicationStatus;
  /** When the status last changed. */
  updatedAt: string;
  /** When you last said you followed up on it. */
  followedUpAt: string | null;
  /** Applied, and a week without news or a follow-up: time to follow up. */
  followUpDue: boolean;
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
  /** Only the jobs in your Apply queue. */
  inApplyQueue?: boolean;
  /** Only jobs whose Fit % is at least this. */
  minFit?: number;
  /** ISO date-time: only jobs posted after it. */
  postedAfter?: string;
  /** True lists only the jobs you hid; otherwise they are left out. */
  hidden?: boolean;
  /** Leave out jobs whose posting our still-open check found closed. */
  hideExpired?: boolean;
  /** Leave out the jobs you marked Applied. */
  hideApplied?: boolean;
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
  /** Add it even when the same job is already on your list. */
  allowDuplicate?: boolean;
}

/** The job types the import can filter on (JobHunter's employment_type_or). */
export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'internship'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/**
 * Where an import looks for jobs. ARBEITSAGENTUR (Germany only) and COMPANY_BOARDS (companies'
 * own career pages on Greenhouse, Lever and Ashby) are free.
 */
export const IMPORT_SOURCES = ['JOBHUNTER', 'ARBEITSAGENTUR', 'COMPANY_BOARDS'] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

export interface SyncJobsInput {
  /** Default JOBHUNTER. */
  source?: ImportSource;
  /** COMPANY_BOARDS only: "greenhouse:stripe", "lever:netflix", "ashby:ramp" or career page addresses. */
  boards?: string[];
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
  /** Things worth knowing, e.g. a company board that could not be read. */
  warnings: string[];
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
  /** e.g. "frontend · DE · Berlin". Company boards are not in it: see `boards`. */
  summary: string;
  /** Where the import looked. */
  source: ImportSource;
  /** The company career pages it read, e.g. "greenhouse:n26". */
  boards: string[];
  /** Stopped with pages left and is the newest import of its search: "Continue" can go on. */
  canContinue: boolean;
}

export interface SavedSearch {
  id: number;
  name: string;
  source: ImportSource;
  boards: string[];
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
  /** Autopilot: after each run, good fits go to the Apply queue and poor ones are hidden. */
  autopilot: boolean;
  autoQueueFitMin: number;
  /** Don't queue a job whose ad says no visa sponsorship. */
  autoQueueNeedsVisa: boolean;
  /** 0 = never hide for its Fit. */
  autoHideFitBelow: number;
  autoQueueMaxPerDay: number;
  createdAt: string;
  lastRun: SyncRun | null;
}

/** A saved search's Autopilot rules, as Saved searches › more › Autopilot saves them. */
export type AutopilotRules = Pick<
  SavedSearch,
  'autopilot' | 'autoQueueFitMin' | 'autoQueueNeedsVisa' | 'autoHideFitBelow' | 'autoQueueMaxPerDay'
>;

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
  /** The language the app is shown in: "en" or "de". */
  locale: string;
  /** Your AI (Settings > API keys): for the AI score and the copy-and-open buttons. */
  aiProvider: AiProvider;
  /** False until you finish or skip the first-login steps (/welcome). */
  onboarded: boolean;
}

export type AiProvider = 'ANTHROPIC' | 'OPENAI';

export interface LogInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends LogInInput {
  name: string;
  /** The language the sign-up page was in; the new account keeps it. */
  locale?: string;
  /** The invite link's code (?invite=…), needed while sign-up is invite only. */
  invite?: string;
}

/** What the sign-up page can do now (see Admin › Sign-up & access). */
export type SignupState = 'OPEN' | 'INVITED' | 'NEEDS_INVITE' | 'INVITE_INVALID' | 'CLOSED';

/** What the user tells us about themselves, plus the text of their master resume. */
/** Genders a form may ask for, as codes; the page shows words for them. */
export const GENDERS = ['female', 'male', 'diverse', 'not_specified'] as const;

/** A field of your own, like "Xing" or "Pronouns". */
export interface ProfileField {
  label: string;
  value: string;
}

export interface Profile {
  /** Empty until saved; the form suggests it from your account name. */
  firstName: string;
  lastName: string;
  /** One of GENDERS, or empty = not given. */
  gender: string;
  /** "YYYY-MM-DD", or empty. */
  dateOfBirth: string;
  nationality: string;
  headline: string;
  targetRoles: string[];
  locations: string[];
  skills: string[];
  /** Words from job ads that are true for you; ✓ on the Fit tab adds them. */
  keywords: string[];
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
  /** e.g. "Full-time". */
  employmentType: string;
  /** e.g. "Remote or hybrid". */
  workplacePreference: string;
  /** e.g. "Class B". */
  drivingLicence: string;
  /** Short answers you reuse on applications, as free text. */
  applicationNotes: string;
  /** Your achievements bank: true facts with numbers, one per line. */
  achievements: string;
  /** Tailored resumes are at most this many pages: 1, 2 or 3. */
  resumeMaxPages: number;
  /** Tailored resumes keep every section heading of your resume, in your order. */
  keepMySections: boolean;
  /** Tell me when a scheduled search finds new jobs that fit me. */
  notifyNewMatches: boolean;
  /** Fill Claude's questions from your saved answers by themselves. */
  fillSavedAnswers: boolean;
  /** Show the Stretches of Claude's reply for a decision. */
  showStretches: boolean;
  /** The Fit % a new job needs to count as a match. */
  matchFitMin: number;
  /** Nightly apply kits: queued jobs' kits written at night with your own AI key. */
  nightlyKits: boolean;
  /** The most kits written in one night. */
  nightlyKitsMax: number;
  /** Morning briefing: once a day in the bell and as a phone push. */
  briefingOn: boolean;
  /** "HH:mm" in the API server's local time. */
  briefingAt: string;
  /** Weekly report: on Sunday evening, your week in the bell and as a phone push. */
  weeklyReport: boolean;
  /** Gmail moves a job by itself when an email is clearly a rejection or an interview invitation. */
  mailAutoStatus: boolean;
  /** Suggestions for your master resume, worked out without AI. */
  resumeSuggestions: ResumeSuggestion[];
  /** A prompt to paste into Claude for a recruiter review of your resume. Empty without one. */
  resumeReviewPrompt: string;
  /** Your own fields for anything else forms ask. */
  customFields: ProfileField[];
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

export type ProfileInput = Omit<
  Profile,
  | 'resumeFileName'
  // The Resume builder edits it (saveResumeBuild); My profile leaves it out.
  | 'resumeText'
  | 'otherResumes'
  | 'updatedAt'
  | 'resumeSuggestions'
  | 'resumeReviewPrompt'
  // Saved on their own, from Settings > Notifications.
  | 'notifyNewMatches'
  | 'matchFitMin'
  // Saved on their own, from Settings > API keys > Nightly apply kits.
  | 'nightlyKits'
  | 'nightlyKitsMax'
  // Saved on their own, from Settings > Notifications > Morning briefing.
  | 'briefingOn'
  | 'briefingAt'
  | 'weeklyReport'
  | 'mailAutoStatus'
>;

/** Settings > Notifications. */
export interface NotificationSettingsInput {
  notifyNewMatches: boolean;
  matchFitMin: number;
}

/** Which service a saved key is for. */
export type ApiKeyKind = 'JOBHUNTER' | 'ANTHROPIC' | 'OPENAI';

/** A key you saved in Settings. The key itself never leaves the server. */
export interface ApiKey {
  kind: ApiKeyKind;
  /** The last 4 characters, e.g. "a9F2". */
  last4: string;
  model: string | null;
  /** JobHunter credits left, as it last said. */
  credits: number | null;
  updatedAt: string;
}

export interface ApiKeyTest {
  ok: boolean;
  credits: number | null;
  error: string | null;
}

/** A suggestion for your master resume. */
export interface ResumeSuggestion {
  code:
    | 'LEVEL'
    | 'DATES'
    | 'CLICHES'
    | 'SYMBOLS'
    | 'NUMBERS'
    | 'LENGTH'
    | 'CONTACT'
    | 'WORK_PERMIT'
    | 'ACHIEVEMENTS';
  /** NUMBERS: "with/bullets"; LENGTH: "words/pages/limit"; ACHIEVEMENTS: the lines. */
  detail: string;
}

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
  /** English, for logs and old clients; the app builds its own translated sentence. */
  message: string;
  /** The raw error from Resume-Matcher or the AI, shown under the translated sentence. */
  error: string | null;
}

export type MatcherResumeState = 'NO_FILE' | 'NOT_SENT' | 'OUTDATED' | 'READY' | 'FAILED';

/** Your master resume's copy in Resume-Matcher, which jobs are matched against. */
export interface MatcherResume {
  state: MatcherResumeState;
  /** The file Resume-Matcher last received. */
  fileName: string | null;
  syncedAt: string | null;
  message: string;
  /** What Resume-Matcher said went wrong. Null unless FAILED. */
  error: string | null;
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
  /** JobHunter's cleaned-up title, when it differs from the posted one. */
  normalizedTitle: string | null;
  /** ISO 639-1 code, e.g. "de". */
  language: string | null;
  /** True when the language was guessed from the text. */
  languageDetected: boolean;
  /** The ad is written in German or asks for German skills (not just as a plus). */
  germanRequired: boolean;
  /** The German level the ad names, e.g. "B2". */
  germanLevel: string | null;
  /** True when the level is read from words like "fließend" (fluent), not named in the ad. */
  germanLevelEstimated: boolean;
  /** The language the prompt asks for: "de" when German is required, else "en". */
  resumeLanguage: string;
  /** The language of the master resume this job was checked against. */
  checkedAgainst: string;
  hasResume: boolean;
  /** The languages line of the prompt: your profile's, or the one edited for this job. */
  languages: string;
  /** True when `languages` was edited for this job. */
  languagesCustom: boolean;
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
  /** The interview prep prompt: paste into Claude for questions, answers and your gaps. */
  interviewPrompt: string;
  mockInterviewPrompt: string;
  mockInterviewPromptDe: string;
  /** What Claude answered to it, if you pasted it back. */
  /** ISO time of your interview for this job, if you set it. */
  interviewAt: string | null;
  /** True when that interview is in your connected Google Calendar. */
  interviewInCalendar: boolean;
  interviewPrep: InterviewPrep | null;
}

/** Claude's interview prep for one job, as pasted back. */
export interface InterviewPrep {
  text: string;
  updatedAt: string;
}

/** The resume you wrote for one job, scored the same way as your profile resume. */
/** Something in a resume that is not in anything you told us (NUMBER, SKILL or LEVEL). */
export interface FactFinding {
  kind: string;
  text: string;
  where: string;
  context: string;
}

export interface JobResume {
  /** The resume as saved (Markdown from Claude's reply), with your edits. */
  text: string;
  /** Name of the uploaded file. Null when the text was pasted. */
  fileName: string | null;
  /** From the Apply kit reply. Empty when there was none. */
  coverLetter: string;
  formAnswers: string;
  /** Claude's CHECK part: terms placed or skipped, stretches, questions for you. */
  claudeCheck: string;
  /** Your decisions on Claude's questions for this job, as JSON text. "{}" when none. */
  claudeAnswers: string;
  updatedAt: string;
  skillsCoverage: number | null;
  keywordsCoverage: number | null;
  titleMatch: number | null;
  /** The "after" score. The job's `score` is the "before". */
  score: number | null;
  /** Resume-Matcher's check of this resume (AI match). Null until asked, and after a new save. */
  aiStatus: JobMatchStatus | null;
  aiScore: number | null;
  aiError: string | null;
  /** Job keywords Resume-Matcher still misses in this resume, and its tips. Empty until READY. */
  aiMissing: string[];
  aiTips: string[];
  /** Skills and keywords it has and your profile resume doesn't. */
  nowCovered: string[];
  /** Skills and keywords still missing. */
  stillMissing: string[];
  /** Numbers, skills and levels that are in the resume but in nothing you told us. */
  factCheck?: FactFinding[] | null;
  /** Skills this resume names that are not on your My skills list: marked gold in Apply step 3. */
  addedSkills: string[];
}

/** One check of the finished resume PDF, read the way an ATS reads it. */
export interface PdfCheckItem {
  code: 'PAGES' | 'TEXT' | 'NAME' | 'EMAIL' | 'DATES' | 'CHARACTERS' | 'PLACEHOLDERS' | 'SKILLS';
  ok: boolean;
  /** "pages/limit" for PAGES, the word count for TEXT, your e-mail for EMAIL, else what is wrong. */
  detail: string;
}

export interface PdfCheck {
  jobId: string;
  template: string;
  items: PdfCheckItem[];
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
  /** Its number in your queue: 1 is applied for first. */
  number: number;
}

/** How your resume and cover letter PDFs look. */
export interface DocumentStyle {
  /** A template id from resumeTemplates, e.g. classic, sharp or jake */
  resumeTemplate: string;
  /** auto (DIN 5008 for German letters), din or modern */
  coverLetterLayout: string;
  /** Six hex digits, e.g. "1F4E79". */
  accentColor: string;
  /** auto, sans or serif */
  font: string;
  showPhoto: boolean;
  hasPhoto: boolean;
  /** The look of your own resume, as settings. Null until you save one. */
  myDesign: MyDesign | null;
  /** Resume body text in points (9 to 12); null is the template's own. */
  fontSize: number | null;
  /** Resume page margins in mm (10 to 25); null is the template's own. */
  margin: number | null;
  /** 1 to 1.4; 1 is the template's own. */
  lineSpacing: number;
  /** Less space between jobs, bullets and sections. */
  compact: boolean;
  /** Skills lines: index (aligned), lines or plain. */
  skillsStyle: string;
  /** The label of a skills line in bold. */
  skillsBold: boolean;
  /** Section titles: auto (the template's own), rule, bold or bar. */
  headingStyle: string;
  /** Dates of a job: auto (the template's own), right or below. */
  datesSide: string;
  /** Bullet shape: dot, dash or none. */
  bulletStyle: string;
}

/** "My design": your resume's look, typeset as the template "design". */
export interface MyDesign {
  font: 'sans' | 'serif' | 'latin';
  accent: string;
  nameSize: 'normal' | 'large' | 'huge';
  nameStyle: 'bold' | 'caps' | 'smallcaps' | 'plain';
  nameColour: 'accent' | 'black';
  align: 'left' | 'centre';
  headingStyle: 'rule' | 'bar' | 'plain';
  headingCase: 'normal' | 'upper';
  headingColour: 'accent' | 'black';
  dates: 'right' | 'below';
  companyFirst: boolean;
  density: 'normal' | 'compact';
  skillsFirst: boolean;
  photo: boolean;
  /** Your resume has two columns; My design always uses one. */
  twoColumns: boolean;
}

export type DocumentStyleInput = Omit<DocumentStyle, 'hasPhoto' | 'myDesign'> & {
  /** My design's own colour; left out, it stays as saved. */
  designAccent?: string | null;
};

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  /** Its own text size (pt) and side margin (mm): built-in templates and My design. */
  fontSize?: number | null;
  margin?: number | null;
}

/** Your Word master resume, used as the template "mine". */
export interface WordTemplate {
  language: string;
  fileName: string;
  /** Its section headings were found, so it can be filled in. */
  usable: boolean;
  sections: string[];
  /** What won't carry over, in plain words. */
  warnings: string[];
}

export interface DocumentTemplates {
  resumeTemplates: DocumentTemplate[];
  coverLetterLayouts: DocumentTemplate[];
  /** Null without a Word (.docx) master resume. */
  wordTemplate: WordTemplate | null;
  /** Paste into Claude with your resume attached: its JSON reply becomes My design. */
  designPrompt: string;
  rendererConfigured: boolean;
  /** The pdf-renderer container answers. Without it, PDFs are plain. */
  rendererAvailable: boolean;
}

/** A Gmail account you connected (read-only). */
export interface GmailAccount {
  id: number;
  email: string;
  connectedAt: string;
  lastSyncAt: string | null;
  /** Why the last check failed, or null when it worked. */
  lastError: string | null;
}

/** Your Google Calendar for interviews (Settings > Gmail). */
export interface GoogleCalendarStatus {
  /** False until the server has a Google client set up. */
  configured: boolean;
  /** The connected Google account, or null when none is. */
  email: string | null;
  /** Why the last calendar change failed, if it did. */
  lastError: string | null;
}

export interface GmailStatus {
  /** False until the server has a Google client set up. */
  configured: boolean;
  accounts: GmailAccount[];
}

/** "This email looks like a rejection: move the job to Rejected?" */
export interface MailSuggestion {
  id: number;
  jobId: string;
  jobTitle: string;
  company: string;
  currentStatus: ApplicationStatus;
  status: ApplicationStatus;
  accountEmail: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  receivedAt: string;
}

export interface GmailSyncResult {
  accounts: number;
  suggestions: number;
  /** Jobs that clear emails moved by themselves (Undo in the bell). */
  moved: number;
  warnings: string[];
}

/** A job a notification points to. */
export interface NotificationJob {
  id: string;
  title: string;
  company: string;
  /** Your Fit % for it when the notification was made. */
  fit: number;
  /** MAIL_AUTO: the status the email moved the job to. */
  status?: ApplicationStatus | null;
}

/** Something the app tells you in the bell list. The words come from `kind`, in your language. */
export interface AppNotification {
  id: number;
  /** NEW_MATCHES: a scheduled search found new jobs that fit you. INTERVIEW_SOON: jobs[0]'s interview is within a day. AUTOPILOT: a search's Autopilot sorted new jobs. */
  kind: string;
  searchName: string;
  count: number;
  fitMin: number;
  jobs: NotificationJob[];
  /** INTERVIEW_SOON: ISO time of the interview. */
  at: string | null;
  /** KEY_REQUEST: the token request's id, so admins can answer it from the bell. */
  refId: number | null;
  /** AUTOPILOT: `count` jobs queued, `hidden` hidden, `kept` left on Job posts. */
  hidden: number;
  kept: number;
  /** AUTOPILOT: you pressed Undo. */
  undone: boolean;
  /** KITS_READY / KITS_FAILED: kits that could not be written. */
  failed: number;
  /** KITS_FAILED, or a kits run that stopped early: NO_KEY, KEY_REFUSED, NO_RESUME, NONE_WRITTEN. */
  reason: string | null;
  /** BRIEFING: what the morning briefing counted. */
  briefing: BriefingCounts | null;
  /** WEEKLY_REPORT: what the weekly report counted. */
  weekly: WeeklyReport | null;
  /** ISO time you read it; null = unread. */
  readAt: string | null;
  createdAt: string;
}

/** What a morning briefing counted. */
export interface BriefingCounts {
  newJobs: number;
  kits: number;
  followUps: number;
  interviews: number;
  replies: number;
}

/** A saved search in the weekly report. */
export interface WeeklySearch {
  id: number;
  name: string;
  /** New jobs its runs brought this week. */
  jobs: number;
  /** Of those, the ones with your match Fit %. */
  good: number;
  /** The search to pause only: its run time, so Pause keeps it. */
  runAt?: string | null;
}

/** What a weekly report counted. */
export interface WeeklyReport {
  applied: number;
  /** Employer replies: Interviewing, Offer or Rejected. */
  replies: number;
  interviews: number;
  newJobs: number;
  goodJobs: number;
  /** The saved search that found the most good jobs. */
  best: WeeklySearch | null;
  /** A scheduled search to pause: many new jobs, none good. */
  pause: WeeklySearch | null;
}

/** Your latest apply-kits run (Write now or the night), while it writes and after. */
export interface KitRun {
  running: boolean;
  /** Kits this run tries to write. */
  total: number;
  /** Jobs finished so far (written or failed). */
  done: number;
  written: number;
  failed: number;
  /** Why it stopped early or wrote none: NO_KEY, KEY_REFUSED, NO_RESUME, NONE_WRITTEN. */
  reason: string | null;
  startedAt: string;
}

export interface Notifications {
  items: AppNotification[];
  unread: number;
}

/** An answer you gave to one of Claude's questions, kept for the next jobs. */
export interface SavedAnswer {
  id: number;
  question: string;
  answer: string;
  updatedAt: string;
}

/** A project inside a job or company: its name, its tech and what you did. */
export interface BuilderProject {
  id: string;
  name: string;
  /** "React, MQTT" */
  tech: string;
  bullets: string[];
}

/** A job, degree or project inside a resume section. */
export interface BuilderEntry {
  id: string;
  kind: 'entry';
  title: string;
  org: string;
  /** "Berlin | 01/2021 - today" */
  meta: string;
  bullets: string[];
  lines: string[];
  /** Missing in resumes saved before projects existed. */
  projects?: BuilderProject[];
}

export type BuilderBlock =
  | BuilderEntry
  | { id: string; kind: 'paragraph'; text: string }
  | { id: string; kind: 'bullets'; items: string[] };

export interface BuilderSection {
  id: string;
  title: string;
  /** Left out of the PDF and of every prompt. */
  hidden: boolean;
  blocks: BuilderBlock[];
}

/** Your resume as the Resume builder edits it. */
export interface BuilderDoc {
  name: string;
  headline: string;
  contact: string[];
  sections: BuilderSection[];
}

/** Your master resume in one language, from the API (doc is JSON text). */
export interface ResumeBuild {
  language: string;
  doc: string;
  outOfDate: boolean;
  /** Languages you have a master resume in; the first is your main one. */
  languages: string[];
  profileLanguages: string[];
  maxPages: number;
  savedAt: string | null;
}

/** A job you have a resume copy for (the Resume page switcher lists them). */
export interface JobResumeCopy {
  jobId: string;
  title: string;
  company: string;
  savedAt: string;
}

/** Your resume for one job, from the API (doc and masterDoc are JSON text). */
export interface JobResumeBuild {
  jobId: string;
  title: string;
  company: string;
  language: string;
  /** False until you start a copy; doc is then your master resume. */
  hasCopy: boolean;
  doc: string;
  /** Your master resume, to see what this copy changed. */
  masterDoc: string;
  profileLanguages: string[];
  maxPages: number;
  savedAt: string | null;
}

/** What "Improve with AI" asks for: one section, with a pasted reply or without (own key). */
export interface ImproveSectionInput {
  sectionId: string;
  jobId?: string | null;
  language?: string | null;
  instruction?: string | null;
  reply?: string | null;
}

/** An improved section to keep or discard (section is JSON text). */
export interface SectionSuggestion {
  sectionId: string;
  before: string;
  after: string;
  section: string;
  findings: FactFinding[];
}

/** The cover letter saved for one job (text: paragraphs separated by a blank line). */
/** Your cover letter template in one language: it starts each job's letter. */
export interface CoverLetterTemplate {
  language: string;
  /** Paragraphs separated by a blank line; {company} and {job} become the job's details. */
  text: string;
  savedAt: string | null;
}

export interface JobCoverLetter {
  jobId: string;
  title: string;
  company: string;
  language: string;
  text: string;
  /** False until you start a resume copy for the job: the letter is stored with it. */
  hasCopy: boolean;
  savedAt: string | null;
}

/** What "write or improve my letter" asks for: with a pasted reply, or without (own key). */
export interface ImproveLetterInput {
  jobId: string;
  instruction?: string | null;
  reply?: string | null;
}

/** A new letter to keep or discard. */
export interface LetterSuggestion {
  before: string;
  after: string;
  findings: FactFinding[];
}

/** One story of your story bank (STAR): situation, task, action, result, and what you learned. */
export interface Story {
  id: number;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  /** Skills or themes it shows, e.g. "leadership". */
  tags: string[];
  updatedAt: string;
}

/** A new story (no id) or a change to one of yours (with its id). */
export type StoryInput = Omit<Story, 'id' | 'updatedAt'> & { id?: number | null };

/** How far applications from one job source got. */
export interface FunnelSource {
  source: JobSource;
  applied: number;
  interviews: number;
  offers: number;
}

/** Your job search funnel. An offer also counts as applied and interviewed. Rates are 0 to 1. */
export interface Funnel {
  tracked: number;
  applied: number;
  interviews: number;
  offers: number;
  rejected: number;
  /** Applied, with no answer yet. */
  waiting: number;
  responseRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
  medianDaysToReply: number | null;
  appliedLast7Days: number;
  appliedLast30Days: number;
  bySource: FunnelSource[];
}

export type JobTrustLevel = 'OK' | 'CAUTION' | 'WARNING';
export type JobTrustFlag =
  | 'ASKS_PAYMENT'
  | 'ASKS_PERSONAL_DATA'
  | 'CHAT_APP_ONLY'
  | 'REPOSTED'
  | 'OLD_AD'
  | 'PRIVATE_EMAIL'
  | 'TOO_GOOD'
  | 'SHORT_AD';

/** "Is this job real?": plain checks for ghost and scam ads, no AI. */
export interface JobTrust {
  level: JobTrustLevel;
  /** Worst first. */
  flags: JobTrustFlag[];
  /** Earlier ads with the same title at the same company (last year). */
  reposts: number;
  firstPostedAt: string | null;
  ageDays: number;
}

/** A similar job with a salary, used for the range. */
export interface SalaryExample {
  jobId: string;
  title: string;
  company: string;
  min: number | null;
  max: number | null;
}

/**
 * Salary research for one job from the jobs we have (no AI). Yearly amounts in the country's
 * currency ("EUR" or "USD"), rounded to 1,000.
 */
export interface SalaryResearch {
  currency: string;
  /** Similar titles, the same job function, or nothing to compare with. */
  basis: 'TITLE' | 'FUNCTION' | 'NONE';
  sampleSize: number;
  estimatedCount: number;
  low: number | null;
  median: number | null;
  high: number | null;
  jobMin: number | null;
  jobMax: number | null;
  ask: number | null;
  examples: SalaryExample[];
  /** Your salary expectation from My profile, as you wrote it. */
  expectation: string;
  /** Paste into Claude: target, scripts, counter-offer email, extras. */
  prompt: string;
}

/** One account on Admin › Users: who it is and counts only, never its jobs, resumes or keys. */
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** ISO date and time the account was made. */
  joinedAt: string;
  /** ISO date and time it last used the app; null = not since this was added. */
  lastSeenAt: string | null;
  /** Switched off by an admin: it can't log in. */
  disabled: boolean;
  /** Has saved a JobHunter token in Settings. */
  hasJobKey: boolean;
  importsThisMonth: number;
}

/** Who can make a new account. */
export type SignupMode = 'OPEN' | 'INVITE' | 'CLOSED';

/** Admin › Sign-up & access and Limits. */
export interface AppSettings {
  signupMode: SignupMode;
  /** Per user and day: scheduled runs stop before going over it. */
  dailyCreditCap: number;
  maxSavedSearches: number;
  schedulerOn: boolean;
  stillOpenOn: boolean;
  /** Key pool: a user's first token request gets a free key at once. */
  poolAutoApprove: boolean;
  /** Key pool: credits each user may spend with a lent key. */
  poolKeyLimit: number;
  /** SCHEDULER_ENABLED=false in .env keeps the scheduler off whatever the switch says. */
  schedulerOffInEnv: boolean;
  stillOpenOffInEnv: boolean;
}

export type AppSettingsChange = Partial<
  Pick<
    AppSettings,
    | 'signupMode'
    | 'dailyCreditCap'
    | 'maxSavedSearches'
    | 'schedulerOn'
    | 'stillOpenOn'
    | 'poolAutoApprove'
    | 'poolKeyLimit'
  >
>;

/** An invite link: /signup?invite=<token>. */
export interface Invite {
  id: number;
  token: string;
  createdAt: string;
  /** Null = never expires. */
  expiresAt: string | null;
  /** Null = any number of times. */
  maxUses: number | null;
  uses: number;
  state: 'ACTIVE' | 'EXPIRED' | 'USED_UP';
}

export type HealthService =
  'DATABASE' | 'PDF_MAKER' | 'RESUME_MATCHER' | 'GMAIL' | 'SCHEDULER' | 'STILL_OPEN';

/** One part of the server on Admin › Overview. */
export interface HealthCheck {
  service: HealthService;
  /** OK = running; DOWN = set up but not answering; OFF = switched off. */
  state: 'OK' | 'DOWN' | 'OFF';
  /** OFF because of .env, not the Admin › Limits switch. */
  offInEnv: boolean;
  /** Scheduler: when the next saved search is due. */
  nextRunAt: string | null;
}

/** Admin › Overview: counts over every account, and server health. */
export interface AdminOverview {
  users: number;
  newThisWeek: number;
  activeThisWeek: number;
  withJobKey: number;
  importsToday: number;
  jobsAddedToday: number;
  /** Imports per day, oldest first, today last. */
  week: { day: string; imports: number }[];
  health: HealthCheck[];
}

/** Where your token request from the Key pool stands. Never any part of a key. */
export interface MyPoolKey {
  state: 'NONE' | 'PENDING' | 'APPROVED' | 'DENIED';
  requestedAt: string | null;
  /** DENIED: the admin's note. */
  note: string | null;
  /** DENIED: when you can ask again. */
  askAgainAt: string | null;
  /** Credits you may spend with a lent key. */
  limit: number;
  /** APPROVED: credits you spent with it so far. */
  used: number;
  /** No key is free right now: a new request joins the waiting list. */
  poolEmpty: boolean;
}

/** A key in the Key pool, by number only. */
export interface PoolKey {
  id: number;
  status: 'FREE' | 'ASSIGNED' | 'EMPTY';
  holder: string | null;
  used: number;
  credits: number | null;
  note: string;
  createdAt: string;
}

export interface KeyRequest {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

/** Admin › Key pool. */
export interface KeyPool {
  free: number;
  assigned: number;
  empty: number;
  limit: number;
  autoApprove: boolean;
  keys: PoolKey[];
  requests: KeyRequest[];
}

export interface AddPoolKeysResult {
  added: number;
  duplicates: number;
  invalid: number;
}

/** What a message to the makers is about. */
export type MessageTopic = 'QUESTION' | 'SUGGESTION' | 'BROKEN';

/** One line in your conversation with the makers: yours, or an admin's answer. */
export interface ChatMessage {
  id: number;
  fromAdmin: boolean;
  /** Who wrote an answer. Empty on your own messages. */
  authorName: string;
  topic: MessageTopic | null;
  body: string;
  createdAt: string;
}

export interface MyMessages {
  items: ChatMessage[];
  /** Answers you have not seen yet. */
  unread: number;
}

/** One user's conversation on Admin › Messages. */
export interface AdminConversation {
  userId: number;
  name: string;
  email: string;
  lastBody: string;
  lastFromAdmin: boolean;
  lastAt: string;
  /** Messages from the user no admin has opened yet. */
  unread: number;
}
