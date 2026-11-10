import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests: the real web app and the real API, in Chromium. They walk through what a new
 * account sees on its first login. Run `pnpm build` first, then `pnpm --filter @jobsearch/web
 * test:browser`. The API runs on its own test database.
 */
const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
if (!testDatabaseUrl) {
  throw new Error('Set TEST_DATABASE_URL (see .env.example): the browser tests use a copy of it.');
}
// Their own database next to the API tests' one (jobsearch_test -> jobsearch_test_browser):
// the API tests add rows with fixed ids, which would make new sign-ups here clash.
const browserDatabase = new URL(testDatabaseUrl);
browserDatabase.pathname = `${browserDatabase.pathname}_browser`;
const testDatabase = browserDatabase.toString();

export default defineConfig({
  testDir: './e2e',
  // One database, and the first account becomes the admin: run the tests one after another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // Creates the database and its tables if needed, then starts the built API.
      command:
        'pnpm --filter @jobsearch/api exec prisma migrate deploy && pnpm --filter @jobsearch/api start',
      url: 'http://localhost:3000/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: testDatabase,
        // Turns off the sign-up limit, which would stop the tests after 10 new accounts.
        NODE_ENV: 'test',
        API_PORT: '3000',
        JWT_SECRET: 'browser-tests-only',
        SCHEDULER_ENABLED: 'false',
        STILL_OPEN_CHECK_ENABLED: 'false',
        GMAIL_SYNC_ENABLED: 'false',
        RESUME_MATCHER_URL: '',
        PDF_RENDERER_URL: '',
      },
    },
    {
      command: 'pnpm start',
      url: 'http://localhost:3001/login',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
