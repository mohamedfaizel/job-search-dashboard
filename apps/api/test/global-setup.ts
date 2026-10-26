import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './env';

/**
 * Applies the migrations to a separate test database so the e2e tests never wipe your
 * dev data. Set TEST_DATABASE_URL in .env to change which database is used.
 */
export default function setup(): void {
  try {
    execSync('pnpm exec prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    });
  } catch {
    // Prisma has already printed the reason above; this says what to do about it.
    const message =
      'Could not prepare the test database. Is PostgreSQL running, and is TEST_DATABASE_URL in .env correct?';
    console.error(`\n${message}\n`); // printed directly: Vitest can garble errors thrown here
    throw new Error(message);
  }
}
