// Load the repo-root .env (if any) so TEST_DATABASE_URL set there is respected.
try {
  process.loadEnvFile('../../.env');
} catch {
  // No .env file (for example in CI, where variables come from the environment).
}

export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://jobsearch:jobsearch@localhost:5432/jobsearch_test';
