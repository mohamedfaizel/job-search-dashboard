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
  | 'POSTED_AT'
  | 'TITLE'
  | 'COMPANY'
  | 'SENIORITY'
  | 'CITY'
  | 'SALARY'
  | 'WORKPLACE'
  | 'APPLICATION_STATUS';

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
  salaryMinUsd: number | null;
  salaryMaxUsd: number | null;
  salaryEstimated: boolean;
  provider: string | null;
  workplace: Workplace | null;
  industry: string | null;
  description: string | null;
  postingStatus: string;
  applicationStatus: ApplicationStatus;
}

export interface JobFilterInput {
  search?: string;
  companies?: string[];
  seniorities?: string[];
  jobFunctions?: string[];
  skills?: string[];
  cities?: string[];
  countryCodes?: string[];
  providers?: string[];
  industries?: string[];
  workplaces?: Workplace[];
  applicationStatuses?: ApplicationStatus[];
  minSalaryUsd?: number;
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
  maxAgeDays?: number;
  pageSize?: number;
  maxPages?: number;
}

export interface SyncJobsResult {
  pages: number;
  fetched: number;
  created: number;
  updated: number;
  totalAvailable: number | null;
  hasMore: boolean;
  creditsRemaining: number | null;
}
