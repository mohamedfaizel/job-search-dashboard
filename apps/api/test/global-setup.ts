import { execSync } from 'node:child_process';

/**
 * Points the e2e tests at a separate database so they never wipe your dev data,
 * then applies the migrations to it. Override with TEST_DATABASE_URL.
 */
export default function setup(): void {
  const url =
    process.env['TEST_DATABASE_URL'] ??
    'postgresql://jobsearch:jobsearch@localhost:5432/jobsearch_test';
  process.env['DATABASE_URL'] = url;
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
