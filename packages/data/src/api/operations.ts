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
    language
    salaryMinUsd
    salaryMaxUsd
    salaryEstimated
    provider
    workplace
    industry
    description
    postingStatus
    applicationStatus
    matchStatus
    matchScore
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

export const MY_APPLICATIONS = /* GraphQL */ `
  query MyApplications {
    myApplications {
      status
      updatedAt
      job {
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
      languages
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

export const HIDE_JOB = /* GraphQL */ `
  mutation HideJob($id: ID!) {
    hideJob(id: $id)
  }
`;

export const UNHIDE_JOB = /* GraphQL */ `
  mutation UnhideJob($id: ID!) {
    unhideJob(id: $id)
  }
`;

export const HIDDEN_JOB_COUNT = /* GraphQL */ `
  query HiddenJobCount {
    hiddenJobCount
  }
`;

const SYNC_RESULT_FIELDS = /* GraphQL */ `
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
  resumed
`;

export const SYNC_JOBS = /* GraphQL */ `
  mutation SyncJobs($input: SyncJobsInput!) {
    syncJobs(input: $input) {
      ${SYNC_RESULT_FIELDS}
    }
  }
`;

const SYNC_RUN_FIELDS = /* GraphQL */ `
  id
  startedAt
  finishedAt
  complete
  fetched
  created
  updated
  creditsCharged
  jobsAlreadyPaid
  savedSearchId
  savedSearchName
  scheduled
  summary
`;

const SAVED_SEARCH_FIELDS = /* GraphQL */ `
  id
  name
  titles
  skills
  countryCodes
  locations
  maxAgeDays
  pageSize
  maxPages
  onlyNew
  schedule
  runAt
  nextRunAt
  scheduleNote
  createdAt
  lastRun {
    ${SYNC_RUN_FIELDS}
  }
`;

export const SAVED_SEARCHES = /* GraphQL */ `
  query SavedSearches {
    savedSearches {
      ${SAVED_SEARCH_FIELDS}
    }
  }
`;

export const SYNC_RUNS = /* GraphQL */ `
  query SyncRuns($limit: Int) {
    syncRuns(limit: $limit) {
      ${SYNC_RUN_FIELDS}
    }
  }
`;

export const CREATE_SAVED_SEARCH = /* GraphQL */ `
  mutation CreateSavedSearch($input: SavedSearchInput!) {
    createSavedSearch(input: $input) {
      ${SAVED_SEARCH_FIELDS}
    }
  }
`;

export const UPDATE_SAVED_SEARCH = /* GraphQL */ `
  mutation UpdateSavedSearch($id: Int!, $input: SavedSearchInput!) {
    updateSavedSearch(id: $id, input: $input) {
      ${SAVED_SEARCH_FIELDS}
    }
  }
`;

export const DELETE_SAVED_SEARCH = /* GraphQL */ `
  mutation DeleteSavedSearch($id: Int!) {
    deleteSavedSearch(id: $id)
  }
`;

export const RUN_SAVED_SEARCH = /* GraphQL */ `
  mutation RunSavedSearch($id: Int!, $resume: Boolean) {
    runSavedSearch(id: $id, resume: $resume) {
      ${SYNC_RESULT_FIELDS}
    }
  }
`;

export const SET_SAVED_SEARCH_SCHEDULE = /* GraphQL */ `
  mutation SetSavedSearchSchedule($id: Int!, $input: ScheduleInput!) {
    setSavedSearchSchedule(id: $id, input: $input) {
      ${SAVED_SEARCH_FIELDS}
    }
  }
`;

export const IMPORT_BUDGET = /* GraphQL */ `
  query ImportBudget {
    importBudget {
      used
      cap
    }
  }
`;

const USER_FIELDS = /* GraphQL */ `
  id
  email
  name
  role
`;

export const ME = /* GraphQL */ `
  query Me {
    me {
      ${USER_FIELDS}
    }
  }
`;

export const SIGN_UP = /* GraphQL */ `
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      ${USER_FIELDS}
    }
  }
`;

export const LOG_IN = /* GraphQL */ `
  mutation LogIn($input: LogInInput!) {
    logIn(input: $input) {
      ${USER_FIELDS}
    }
  }
`;

export const LOG_OUT = /* GraphQL */ `
  mutation LogOut {
    logOut
  }
`;

const PROFILE_FIELDS = /* GraphQL */ `
  headline
  targetRoles
  locations
  skills
  yearsExperience
  linkedinUrl
  githubUrl
  websiteUrl
  resumeText
  resumeFileName
  updatedAt
`;

export const MY_PROFILE = /* GraphQL */ `
  query MyProfile {
    myProfile {
      ${PROFILE_FIELDS}
    }
  }
`;

export const UPDATE_PROFILE = /* GraphQL */ `
  mutation UpdateProfile($input: ProfileInput!) {
    updateProfile(input: $input) {
      ${PROFILE_FIELDS}
    }
  }
`;

export const RESUME_MATCHER_STATUS = /* GraphQL */ `
  query ResumeMatcherStatus($checkAi: Boolean) {
    resumeMatcherStatus(checkAi: $checkAi) {
      configured
      reachable
      aiConfigured
      aiHealthy
      aiProvider
      aiModel
      message
    }
  }
`;

const MATCHER_RESUME_FIELDS = /* GraphQL */ `
  state
  fileName
  syncedAt
  message
`;

export const MY_MATCHER_RESUME = /* GraphQL */ `
  query MyMatcherResume {
    myMatcherResume {
      ${MATCHER_RESUME_FIELDS}
    }
  }
`;

export const SYNC_RESUME_TO_MATCHER = /* GraphQL */ `
  mutation SyncResumeToMatcher {
    syncResumeToMatcher {
      ${MATCHER_RESUME_FIELDS}
    }
  }
`;

const JOB_MATCH_FIELDS = /* GraphQL */ `
  fragment JobMatchFields on JobMatch {
    jobId
    status
    error
    score
    keywordMatchBefore
    keywordMatch
    skillsCoverage
    titleMatch
    sectionCompleteness
    dateConsistency
    missingKeywords
    injectableKeywords
    recommendations
    resumeFileName
    startedAt
    finishedAt
    outdated
  }
`;

export const JOB_MATCH = /* GraphQL */ `
  query JobMatch($jobId: ID!) {
    jobMatch(jobId: $jobId) {
      ...JobMatchFields
    }
  }
  ${JOB_MATCH_FIELDS}
`;

export const MATCH_JOB = /* GraphQL */ `
  mutation MatchJob($jobId: ID!) {
    matchJob(jobId: $jobId) {
      ...JobMatchFields
    }
  }
  ${JOB_MATCH_FIELDS}
`;

const TAILORED_RESUME_FIELDS = /* GraphQL */ `
  fragment TailoredResumeFields on TailoredResume {
    jobId
    status
    error
    score
    coverLetter
    resumeFileName
    startedAt
    finishedAt
    outdated
  }
`;

export const TAILORED_RESUME = /* GraphQL */ `
  query TailoredResume($jobId: ID!) {
    tailoredResume(jobId: $jobId) {
      ...TailoredResumeFields
    }
  }
  ${TAILORED_RESUME_FIELDS}
`;

export const TAILOR_RESUME = /* GraphQL */ `
  mutation TailorResume($jobId: ID!) {
    tailorResume(jobId: $jobId) {
      ...TailoredResumeFields
    }
  }
  ${TAILORED_RESUME_FIELDS}
`;

const JOB_INSIGHTS_FIELDS = /* GraphQL */ `
  fragment JobInsightsFields on JobInsights {
    jobId
    title
    normalizedTitle
    language
    languageDetected
    hasResume
    skills {
      term
      inResume
    }
    keywords {
      term
      inResume
    }
    removed {
      term
      everywhere
    }
    skillsCoverage
    keywordsCoverage
    titleMatch
    score
    jobResume {
      fileName
      updatedAt
      skillsCoverage
      keywordsCoverage
      titleMatch
      score
      nowCovered
      stillMissing
    }
    prompt
  }
`;

export const JOB_INSIGHTS = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  query JobInsights($jobId: ID!) {
    jobInsights(jobId: $jobId) {
      ...JobInsightsFields
    }
  }
`;

export const REMOVE_INSIGHT_TERM = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation RemoveInsightTerm($jobId: ID!, $term: String!, $everywhere: Boolean) {
    removeInsightTerm(jobId: $jobId, term: $term, everywhere: $everywhere) {
      ...JobInsightsFields
    }
  }
`;

export const RESTORE_INSIGHT_TERM = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation RestoreInsightTerm($jobId: ID!, $term: String!) {
    restoreInsightTerm(jobId: $jobId, term: $term) {
      ...JobInsightsFields
    }
  }
`;

export const SAVE_JOB_RESUME_TEXT = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation SaveJobResumeText($jobId: ID!, $text: String!) {
    saveJobResumeText(jobId: $jobId, text: $text) {
      ...JobInsightsFields
    }
  }
`;

export const DELETE_JOB_RESUME = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation DeleteJobResume($jobId: ID!) {
    deleteJobResume(jobId: $jobId) {
      ...JobInsightsFields
    }
  }
`;
