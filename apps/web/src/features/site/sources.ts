/**
 * The live sources JobHunter searches, in three groups. Shown on the intro page so people see
 * how many boards one search covers. Names only: no logos.
 */
export const JOB_HUNTER_SOURCES = {
  boards: [
    'LinkedIn',
    'Indeed',
    'CV-Library',
    'Resume-Library',
    'Y Combinator',
    'Arbeitnow',
    'Himalayas',
    'Jobicy',
    'The Muse',
    'RemoteOK',
    'Working Nomads',
    'Landing.jobs',
    'Remotive',
    'Rise',
    'Bayt',
    'Welcome to the Jungle',
    'Otta',
  ],
  public: ['EURES', 'JobTech', 'France Travail', 'Choisir le service public'],
  ats: [
    'Greenhouse',
    'Workday',
    'Ashby',
    'Lever',
    'Workable',
    'Recruitee',
    'Personio',
    'SmartRecruiters',
    'Oracle',
    'iCIMS',
    'SuccessFactors',
    'Breezy',
    'Paylocity',
    'Manatal',
    'JobScore',
    'Teamtailor',
    'Pinpoint',
    'HireHive',
    'BambooHR',
  ],
} as const;

/** How many sources in all ("40+" on the page). */
export const SOURCE_COUNT = Object.values(JOB_HUNTER_SOURCES).reduce((n, g) => n + g.length, 0);
