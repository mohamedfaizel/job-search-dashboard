// GraphQL documents. The operation names (JobsPage, CreateJob…) also identify requests in
// the browser's network tab and in MSW test handlers.

const JOB_FIELDS = /* GraphQL */ `
  fragment JobFields on Job {
    id
    source
    title
    company {
      id
      name
      logoUrl
    }
    url
    postedAt
    seniority
    jobFunction
    skills
    city
    countryCode
    salaryMinUsd
    salaryMaxUsd
    salaryEstimated
    provider
    workplace
    industry
    description
    postingStatus
    applicationStatus
  }
`;

export const JOBS_PAGE = /* GraphQL */ `
  query JobsPage($filter: JobFilterInput, $sort: JobSortInput, $page: Int!, $pageSize: Int!) {
    jobsPage(filter: $filter, sort: $sort, page: $page, pageSize: $pageSize) {
      total
      page
      pageSize
      items {
        ...JobFields
      }
    }
  }
  ${JOB_FIELDS}
`;

export const JOB_FILTER_OPTIONS = /* GraphQL */ `
  query JobFilterOptions {
    jobFilterOptions {
      companies
      seniorities
      jobFunctions
      skills
      cities
      countryCodes
      providers
      industries
    }
  }
`;

export const CREATE_JOB = /* GraphQL */ `
  mutation CreateJob($input: CreateJobInput!) {
    createJob(input: $input) {
      ...JobFields
    }
  }
  ${JOB_FIELDS}
`;

export const UPDATE_JOB_STATUS = /* GraphQL */ `
  mutation UpdateJobStatus($id: ID!, $status: ApplicationStatus!) {
    updateJobStatus(id: $id, status: $status) {
      id
      applicationStatus
    }
  }
`;

export const SYNC_JOBS = /* GraphQL */ `
  mutation SyncJobs($input: SyncJobsInput!) {
    syncJobs(input: $input) {
      pages
      fetched
      created
      updated
      totalAvailable
      hasMore
      creditsRemaining
      creditsCharged
      jobsAlreadyPaid
      newSince
    }
  }
`;
