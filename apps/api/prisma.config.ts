import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env on its own. Load the shared repo-root .env if it exists.
try {
  process.loadEnvFile('../../.env');
} catch {
  // No .env file (for example in CI, where variables come from the environment).
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // `prisma generate` doesn't connect, so a placeholder keeps it working without a database.
    url: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/placeholder',
  },
});
