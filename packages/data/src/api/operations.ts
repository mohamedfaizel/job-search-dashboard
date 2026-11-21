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
    visa
    industry
    description
    postingStatus
    checkedAt
    lastCheck
    checkReason
    applicationStatus
    matchStatus
    matchScore
    fitScore
    applyScore
    createdAt
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

/** One job by id, for opening a job that isn't on the current page (e.g. from the Apply queue). */
export const JOB = /* GraphQL */ `
  query Job($id: ID!) {
    job(id: $id) {
      ...JobFields
    }
  }
  ${JOB_FIELDS}
`;

export const MY_APPLICATIONS = /* GraphQL */ `
  query MyApplications {
    myApplications {
      status
      updatedAt
      followedUpAt
      followUpDue
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

/** Opens the job's link to see if it is still open. Returns the job with the answer. */
export const CHECK_JOB_STILL_OPEN = /* GraphQL */ `
  mutation CheckJobStillOpen($id: ID!) {
    checkJobStillOpen(id: $id) {
      ...JobFields
    }
  }
  ${JOB_FIELDS}
`;

/** Says you followed up on an application. Returns your whole tracker. */
export const MARK_FOLLOWED_UP = /* GraphQL */ `
  mutation MarkFollowedUp($jobId: ID!) {
    markFollowedUp(jobId: $jobId) {
      status
      updatedAt
      followedUpAt
      followUpDue
      job {
        ...JobFields
      }
    }
  }
  ${JOB_FIELDS}
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
  warnings
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
  source
  boards
`;

const SAVED_SEARCH_FIELDS = /* GraphQL */ `
  id
  name
  source
  boards
  titles
  skills
  countryCodes
  locations
  languages
  skipFluentGerman
  remoteOnly
  excludeTitles
  employmentTypes
  minSalaryEur
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
  locale
  aiProvider
  onboarded
`;

export const FINISH_ONBOARDING = /* GraphQL */ `
  mutation FinishOnboarding {
    finishOnboarding {
      ${USER_FIELDS}
    }
  }
`;

export const SET_LOCALE = /* GraphQL */ `
  mutation SetLocale($locale: String!) {
    setLocale(locale: $locale) {
      ${USER_FIELDS}
    }
  }
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
  firstName
  lastName
  gender
  dateOfBirth
  nationality
  headline
  targetRoles
  locations
  skills
  keywords
  languages
  yearsExperience
  linkedinUrl
  githubUrl
  websiteUrl
  resumeText
  resumeFileName
  resumeLanguage
  otherResumes {
    language
    text
    fileName
    updatedAt
  }
  phone
  address
  workPermit
  noticePeriod
  salaryExpectation
  relocation
  employmentType
  workplacePreference
  drivingLicence
  applicationNotes
  achievements
  resumeMaxPages
  keepMySections
  notifyNewMatches
  fillSavedAnswers
  showStretches
  matchFitMin
  resumeSuggestions {
    code
    detail
  }
  resumeReviewPrompt
  customFields {
    label
    value
  }
  updatedAt
`;

export const MY_PROFILE = /* GraphQL */ `
  query MyProfile {
    myProfile {
      ${PROFILE_FIELDS}
    }
  }
`;

export const SAVE_LANGUAGE_RESUME = /* GraphQL */ `
  mutation SaveLanguageResume($language: String!, $text: String!) {
    saveLanguageResume(language: $language, text: $text) {
      ${PROFILE_FIELDS}
    }
  }
`;

export const DELETE_LANGUAGE_RESUME = /* GraphQL */ `
  mutation DeleteLanguageResume($language: String!) {
    deleteLanguageResume(language: $language) {
      ${PROFILE_FIELDS}
    }
  }
`;

export const TRANSLATION_PROMPT = /* GraphQL */ `
  query TranslationPrompt($language: String!) {
    translationPrompt(language: $language)
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
      error
    }
  }
`;

const MATCHER_RESUME_FIELDS = /* GraphQL */ `
  state
  fileName
  syncedAt
  message
  error
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
    germanRequired
    germanLevel
    germanLevelEstimated
    resumeLanguage
    checkedAgainst
    hasResume
    languages
    languagesCustom
    skills {
      term
      inResume
      youHave
      relatedTo
    }
    keywords {
      term
      inResume
      youHave
      relatedTo
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
      text
      fileName
      coverLetter
      formAnswers
      claudeCheck
      claudeAnswers
      updatedAt
      skillsCoverage
      keywordsCoverage
      titleMatch
      score
      aiStatus
      aiScore
      aiError
      aiMissing
      aiTips
      nowCovered
      stillMissing
      factCheck {
        kind
        text
        where
        context
      }
    }
    prompt
    interviewPrompt
    mockInterviewPrompt
    mockInterviewPromptDe
    interviewAt
    interviewPrep {
      text
      updatedAt
    }
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

export const SET_HAVE_TERM = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation SetHaveTerm($jobId: ID!, $term: String!, $have: Boolean, $keyword: Boolean) {
    setHaveTerm(jobId: $jobId, term: $term, have: $have, keyword: $keyword) {
      ...JobInsightsFields
    }
  }
`;

export const SET_JOB_LANGUAGES = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation SetJobLanguages($jobId: ID!, $languages: String) {
    setJobLanguages(jobId: $jobId, languages: $languages) {
      ...JobInsightsFields
    }
  }
`;

export const MATCH_JOB_RESUME = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation MatchJobResume($jobId: ID!) {
    matchJobResume(jobId: $jobId) {
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

export const EDIT_JOB_RESUME = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation EditJobResume(
    $jobId: ID!
    $resume: String!
    $coverLetter: String!
    $formAnswers: String!
  ) {
    editJobResume(
      jobId: $jobId
      resume: $resume
      coverLetter: $coverLetter
      formAnswers: $formAnswers
    ) {
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

export const SAVE_INTERVIEW_PREP = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation SaveInterviewPrep($jobId: ID!, $text: String!) {
    saveInterviewPrep(jobId: $jobId, text: $text) {
      ...JobInsightsFields
    }
  }
`;

export const SET_INTERVIEW_DATE = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation SetInterviewDate($jobId: ID!, $at: DateTime) {
    setInterviewDate(jobId: $jobId, at: $at) {
      ...JobInsightsFields
    }
  }
`;

export const DELETE_INTERVIEW_PREP = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation DeleteInterviewPrep($jobId: ID!) {
    deleteInterviewPrep(jobId: $jobId) {
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

const APPLY_QUEUE_FIELDS = /* GraphQL */ `
  jobId
  title
  company
  url
  ready
  addedAt
  number
`;

export const APPLY_QUEUE = /* GraphQL */ `
  query ApplyQueue {
    myApplyQueue {
      ${APPLY_QUEUE_FIELDS}
    }
  }
`;

export const ADD_TO_APPLY_QUEUE = /* GraphQL */ `
  mutation AddToApplyQueue($jobIds: [ID!]!) {
    addToApplyQueue(jobIds: $jobIds) {
      ${APPLY_QUEUE_FIELDS}
    }
  }
`;

export const MOVE_IN_APPLY_QUEUE = /* GraphQL */ `
  mutation MoveInApplyQueue($jobId: ID!, $direction: QueueDirection!) {
    moveInApplyQueue(jobId: $jobId, direction: $direction) {
      ${APPLY_QUEUE_FIELDS}
    }
  }
`;

export const REMOVE_FROM_APPLY_QUEUE = /* GraphQL */ `
  mutation RemoveFromApplyQueue($jobIds: [ID!]!) {
    removeFromApplyQueue(jobIds: $jobIds) {
      ${APPLY_QUEUE_FIELDS}
    }
  }
`;

export const APPLY_QUEUE_PROMPT = /* GraphQL */ `
  query ApplyQueuePrompt {
    applyQueuePrompt {
      prompt
      jobIds
      waiting
    }
  }
`;

export const SAVE_APPLY_QUEUE_REPLY = /* GraphQL */ `
  mutation SaveApplyQueueReply($text: String!) {
    saveApplyQueueReply(text: $text) {
      ${APPLY_QUEUE_FIELDS}
    }
  }
`;

export const RECALCULATE_FIT = /* GraphQL */ `
  mutation RecalculateFit {
    recalculateFit
  }
`;

export const MY_TABLE_SETTINGS = /* GraphQL */ `
  query MyTableSettings {
    myTableSettings
  }
`;

export const SAVE_TABLE_SETTINGS = /* GraphQL */ `
  mutation SaveTableSettings($settings: String!) {
    saveTableSettings(settings: $settings)
  }
`;

export const START_JOBS_VISIT = /* GraphQL */ `
  mutation StartJobsVisit {
    startJobsVisit
  }
`;

const DOCUMENT_STYLE_FIELDS = /* GraphQL */ `
  resumeTemplate
  coverLetterLayout
  accentColor
  font
  showPhoto
  hasPhoto
  fontSize
  margin
  lineSpacing
  compact
  skillsStyle
  skillsBold
  headingStyle
  datesSide
  bulletStyle
  myDesign {
    font
    accent
    nameSize
    nameStyle
    nameColour
    align
    headingStyle
    headingCase
    headingColour
    dates
    companyFirst
    density
    skillsFirst
    photo
    twoColumns
  }
`;

export const DOCUMENT_STYLE = /* GraphQL */ `
  query DocumentStyle {
    documentStyle {
      ${DOCUMENT_STYLE_FIELDS}
    }
  }
`;

export const UPDATE_DOCUMENT_STYLE = /* GraphQL */ `
  mutation UpdateDocumentStyle($input: DocumentStyleInput!) {
    updateDocumentStyle(input: $input) {
      ${DOCUMENT_STYLE_FIELDS}
    }
  }
`;

export const SAVE_MY_DESIGN = /* GraphQL */ `
  mutation SaveMyDesign($reply: String!) {
    saveMyDesign(reply: $reply) {
      ${DOCUMENT_STYLE_FIELDS}
    }
  }
`;

export const DELETE_MY_DESIGN = /* GraphQL */ `
  mutation DeleteMyDesign {
    deleteMyDesign {
      ${DOCUMENT_STYLE_FIELDS}
    }
  }
`;

export const DOCUMENT_TEMPLATES = /* GraphQL */ `
  query DocumentTemplates {
    documentTemplates {
      resumeTemplates {
        id
        name
        description
        fontSize
        margin
      }
      coverLetterLayouts {
        id
        name
        description
      }
      wordTemplate {
        language
        fileName
        usable
        sections
        warnings
      }
      designPrompt
      rendererConfigured
      rendererAvailable
    }
  }
`;

export const GMAIL_STATUS = /* GraphQL */ `
  query GmailStatus {
    gmailStatus {
      configured
      accounts {
        id
        email
        connectedAt
        lastSyncAt
        lastError
      }
    }
  }
`;

export const MAIL_SUGGESTIONS = /* GraphQL */ `
  query MailSuggestions {
    mailSuggestions {
      id
      jobId
      jobTitle
      company
      currentStatus
      status
      accountEmail
      fromAddress
      subject
      snippet
      receivedAt
    }
  }
`;

export const SYNC_GMAIL = /* GraphQL */ `
  mutation SyncGmail {
    syncGmail {
      accounts
      suggestions
      warnings
    }
  }
`;

export const DISCONNECT_GMAIL = /* GraphQL */ `
  mutation DisconnectGmail($id: Int!) {
    disconnectGmail(id: $id)
  }
`;

export const APPROVE_MAIL_SUGGESTION = /* GraphQL */ `
  mutation ApproveMailSuggestion($id: Int!) {
    approveMailSuggestion(id: $id)
  }
`;

export const DISMISS_MAIL_SUGGESTION = /* GraphQL */ `
  mutation DismissMailSuggestion($id: Int!) {
    dismissMailSuggestion(id: $id)
  }
`;

export const RESUME_PDF_CHECK = /* GraphQL */ `
  query ResumePdfCheck($jobId: ID!, $template: String) {
    resumePdfCheck(jobId: $jobId, template: $template) {
      jobId
      template
      items {
        code
        ok
        detail
      }
    }
  }
`;

export const NOTIFICATIONS = /* GraphQL */ `
  query Notifications {
    notifications {
      unread
      items {
        id
        kind
        searchName
        count
        fitMin
        at
        readAt
        createdAt
        jobs {
          id
          title
          company
          fit
        }
      }
    }
  }
`;

export const MARK_NOTIFICATIONS_READ = /* GraphQL */ `
  mutation MarkNotificationsRead {
    markNotificationsRead
  }
`;

export const SAVED_ANSWERS = /* GraphQL */ `
  query SavedAnswers {
    savedAnswers {
      id
      question
      answer
      updatedAt
    }
  }
`;

export const SAVE_ANSWER = /* GraphQL */ `
  mutation SaveAnswer($question: String!, $answer: String!) {
    saveAnswer(question: $question, answer: $answer) {
      id
      question
      answer
      updatedAt
    }
  }
`;

export const DELETE_SAVED_ANSWER = /* GraphQL */ `
  mutation DeleteSavedAnswer($id: Int!) {
    deleteSavedAnswer(id: $id)
  }
`;

export const SAVE_CLAUDE_ANSWERS = /* GraphQL */ `
  ${JOB_INSIGHTS_FIELDS}
  mutation SaveClaudeAnswers($jobId: ID!, $answers: String!) {
    saveClaudeAnswers(jobId: $jobId, answers: $answers) {
      ...JobInsightsFields
    }
  }
`;

export const MY_API_KEYS = /* GraphQL */ `
  query MyApiKeys {
    myApiKeys {
      kind
      last4
      model
      credits
      updatedAt
    }
  }
`;

export const SAVE_API_KEY = /* GraphQL */ `
  mutation SaveApiKey($input: SaveApiKeyInput!) {
    saveApiKey(input: $input) {
      kind
      last4
      model
      credits
      updatedAt
    }
  }
`;

export const DELETE_API_KEY = /* GraphQL */ `
  mutation DeleteApiKey($kind: ApiKeyKind!) {
    deleteApiKey(kind: $kind)
  }
`;

export const TEST_API_KEY = /* GraphQL */ `
  mutation TestApiKey($kind: ApiKeyKind!) {
    testApiKey(kind: $kind) {
      ok
      credits
      error
    }
  }
`;

export const UPDATE_NOTIFICATION_SETTINGS = /* GraphQL */ `
  mutation UpdateNotificationSettings($input: NotificationSettingsInput!) {
    updateNotificationSettings(input: $input) {
      ${PROFILE_FIELDS}
    }
  }
`;

export const SET_API_KEY_MODEL = /* GraphQL */ `
  mutation SetApiKeyModel($kind: ApiKeyKind!, $model: String) {
    setApiKeyModel(kind: $kind, model: $model) {
      kind
      last4
      model
      credits
      updatedAt
    }
  }
`;

export const SET_AI_PROVIDER = /* GraphQL */ `
  mutation SetAiProvider($provider: AiProvider!) {
    setAiProvider(provider: $provider) {
      ${USER_FIELDS}
    }
  }
`;

const RESUME_BUILD_FIELDS = `language doc outOfDate languages profileLanguages maxPages savedAt`;

export const RESUME_BUILD = /* GraphQL */ `
  query ResumeBuild($language: String) {
    resumeBuild(language: $language) {
      ${RESUME_BUILD_FIELDS}
    }
  }
`;

export const RESUME_BUILD_PROMPT = /* GraphQL */ `
  query ResumeBuildPrompt($language: String!) {
    resumeBuildPrompt(language: $language)
  }
`;

export const SAVE_RESUME_BUILD = /* GraphQL */ `
  mutation SaveResumeBuild($language: String!, $doc: String!) {
    saveResumeBuild(language: $language, doc: $doc) {
      ${RESUME_BUILD_FIELDS}
    }
  }
`;

export const RESTART_RESUME_BUILD = /* GraphQL */ `
  mutation RestartResumeBuild($language: String!, $reply: String) {
    restartResumeBuild(language: $language, reply: $reply) {
      ${RESUME_BUILD_FIELDS}
    }
  }
`;

const JOB_RESUME_BUILD_FIELDS = `jobId title company language hasCopy doc masterDoc profileLanguages maxPages savedAt`;

export const JOB_RESUME_COPIES = /* GraphQL */ `
  query JobResumeCopies {
    jobResumeCopies {
      jobId
      title
      company
      savedAt
    }
  }
`;

export const JOB_RESUME_BUILD = /* GraphQL */ `
  query JobResumeBuild($jobId: String!) {
    jobResumeBuild(jobId: $jobId) {
      ${JOB_RESUME_BUILD_FIELDS}
    }
  }
`;

export const START_JOB_RESUME_BUILD = /* GraphQL */ `
  mutation StartJobResumeBuild($jobId: String!) {
    startJobResumeBuild(jobId: $jobId) {
      ${JOB_RESUME_BUILD_FIELDS}
    }
  }
`;

export const SAVE_JOB_RESUME_BUILD = /* GraphQL */ `
  mutation SaveJobResumeBuild($jobId: String!, $doc: String!) {
    saveJobResumeBuild(jobId: $jobId, doc: $doc) {
      ${JOB_RESUME_BUILD_FIELDS}
    }
  }
`;

export const RESET_JOB_RESUME_BUILD = /* GraphQL */ `
  mutation ResetJobResumeBuild($jobId: String!) {
    resetJobResumeBuild(jobId: $jobId) {
      ${JOB_RESUME_BUILD_FIELDS}
    }
  }
`;

export const COPY_SECTION_TO_MASTER = /* GraphQL */ `
  mutation CopySectionToMaster($jobId: String!, $sectionId: String!) {
    copySectionToMaster(jobId: $jobId, sectionId: $sectionId) {
      ${JOB_RESUME_BUILD_FIELDS}
    }
  }
`;

export const IMPROVE_SECTION_PROMPT = /* GraphQL */ `
  query ImproveSectionPrompt($input: ImproveSectionInput!) {
    improveSectionPrompt(input: $input)
  }
`;

export const IMPROVE_SECTION = /* GraphQL */ `
  mutation ImproveSection($input: ImproveSectionInput!) {
    improveSection(input: $input) {
      sectionId
      before
      after
      section
      findings {
        kind
        text
        where
        context
      }
    }
  }
`;

const COVER_LETTER_TEMPLATE_FIELDS = `language text savedAt`;

export const COVER_LETTER_TEMPLATE = /* GraphQL */ `
  query CoverLetterTemplate($language: String!) {
    coverLetterTemplate(language: $language) {
      ${COVER_LETTER_TEMPLATE_FIELDS}
    }
  }
`;

export const SAVE_COVER_LETTER_TEMPLATE = /* GraphQL */ `
  mutation SaveCoverLetterTemplate($language: String!, $text: String!) {
    saveCoverLetterTemplate(language: $language, text: $text) {
      ${COVER_LETTER_TEMPLATE_FIELDS}
    }
  }
`;

const JOB_COVER_LETTER_FIELDS = `jobId title company language text hasCopy savedAt`;

export const JOB_COVER_LETTER = /* GraphQL */ `
  query JobCoverLetter($jobId: String!) {
    jobCoverLetter(jobId: $jobId) {
      ${JOB_COVER_LETTER_FIELDS}
    }
  }
`;

export const SAVE_JOB_COVER_LETTER = /* GraphQL */ `
  mutation SaveJobCoverLetter($jobId: String!, $text: String!) {
    saveJobCoverLetter(jobId: $jobId, text: $text) {
      ${JOB_COVER_LETTER_FIELDS}
    }
  }
`;

export const IMPROVE_LETTER_PROMPT = /* GraphQL */ `
  query ImproveLetterPrompt($input: ImproveLetterInput!) {
    improveLetterPrompt(input: $input)
  }
`;

export const IMPROVE_LETTER = /* GraphQL */ `
  mutation ImproveLetter($input: ImproveLetterInput!) {
    improveLetter(input: $input) {
      before
      after
      findings {
        kind
        text
        where
        context
      }
    }
  }
`;

const STORY_FIELDS = `id title situation task action result reflection tags updatedAt`;

export const STORIES = /* GraphQL */ `
  query Stories {
    stories {
      ${STORY_FIELDS}
    }
  }
`;

export const SAVE_STORY = /* GraphQL */ `
  mutation SaveStory($input: StoryInput!) {
    saveStory(input: $input) {
      ${STORY_FIELDS}
    }
  }
`;

export const DELETE_STORY = /* GraphQL */ `
  mutation DeleteStory($id: Int!) {
    deleteStory(id: $id)
  }
`;

export const FUNNEL = /* GraphQL */ `
  query Funnel {
    funnel {
      tracked
      applied
      interviews
      offers
      rejected
      waiting
      responseRate
      interviewRate
      offerRate
      medianDaysToReply
      appliedLast7Days
      appliedLast30Days
      bySource {
        source
        applied
        interviews
        offers
      }
    }
  }
`;

export const JOB_TRUST = /* GraphQL */ `
  query JobTrust($id: ID!) {
    jobTrust(id: $id) {
      level
      flags
      reposts
      firstPostedAt
      ageDays
    }
  }
`;

export const SALARY_RESEARCH = /* GraphQL */ `
  query SalaryResearch($jobId: ID!) {
    salaryResearch(jobId: $jobId) {
      currency
      basis
      sampleSize
      estimatedCount
      low
      median
      high
      jobMin
      jobMax
      ask
      examples {
        jobId
        title
        company
        min
        max
      }
      expectation
      prompt
    }
  }
`;

const ADMIN_USER_FIELDS = `
  id
  name
  email
  role
  joinedAt
  lastSeenAt
  disabled
  hasJobKey
  importsThisMonth
`;

export const ADMIN_USERS = /* GraphQL */ `
  query AdminUsers {
    adminUsers {
      ${ADMIN_USER_FIELDS}
    }
  }
`;

export const SET_USER_ROLE = /* GraphQL */ `
  mutation SetUserRole($input: SetUserRoleInput!) {
    setUserRole(input: $input) {
      ${ADMIN_USER_FIELDS}
    }
  }
`;

export const SET_USER_DISABLED = /* GraphQL */ `
  mutation SetUserDisabled($input: SetUserDisabledInput!) {
    setUserDisabled(input: $input) {
      ${ADMIN_USER_FIELDS}
    }
  }
`;

export const DELETE_USER = /* GraphQL */ `
  mutation DeleteUser($input: DeleteUserInput!) {
    deleteUser(input: $input)
  }
`;

export const SIGNUP_STATE = /* GraphQL */ `
  query SignupState($invite: String) {
    signupState(invite: $invite)
  }
`;

const APP_SETTINGS_FIELDS = `
  signupMode
  dailyCreditCap
  maxSavedSearches
  schedulerOn
  stillOpenOn
  schedulerOffInEnv
  stillOpenOffInEnv
`;

export const APP_SETTINGS = /* GraphQL */ `
  query AppSettings {
    appSettings {
      ${APP_SETTINGS_FIELDS}
    }
  }
`;

export const UPDATE_APP_SETTINGS = /* GraphQL */ `
  mutation UpdateAppSettings($input: UpdateAppSettingsInput!) {
    updateAppSettings(input: $input) {
      ${APP_SETTINGS_FIELDS}
    }
  }
`;

const INVITE_FIELDS = `
  id
  token
  createdAt
  expiresAt
  maxUses
  uses
  state
`;

export const INVITES = /* GraphQL */ `
  query Invites {
    invites {
      ${INVITE_FIELDS}
    }
  }
`;

export const CREATE_INVITE = /* GraphQL */ `
  mutation CreateInvite($input: CreateInviteInput!) {
    createInvite(input: $input) {
      ${INVITE_FIELDS}
    }
  }
`;

export const CANCEL_INVITE = /* GraphQL */ `
  mutation CancelInvite($id: Int!) {
    cancelInvite(id: $id)
  }
`;

export const ADMIN_OVERVIEW = /* GraphQL */ `
  query AdminOverview {
    adminOverview {
      users
      newThisWeek
      activeThisWeek
      withJobKey
      importsToday
      jobsAddedToday
      week {
        day
        imports
      }
      health {
        service
        state
        offInEnv
        nextRunAt
      }
    }
  }
`;
