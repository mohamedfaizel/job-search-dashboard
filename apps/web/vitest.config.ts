import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };
// Each screen has its own fake API (its own test/setup.ts),
// so it runs as its own Vitest project.
const FEATURES = [
  // The profile page is a big form: on a busy CI runner a test can take a few seconds.
  { name: 'profile', testTimeout: 15_000 },
  { name: 'jobs', testTimeout: 15_000 },
  { name: 'add-jobs', testTimeout: 15_000 },
];

const base = { globals: true, environment: 'jsdom', css: false } as const;

// Components are tested in jsdom; Next's router is mocked where a test needs it.
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    // `pnpm test:coverage` writes coverage/lcov.info for SonarCloud, with paths from the repo root.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', ['lcov', { projectRoot: '../..' }]],
      include: ['src/**'],
    },
    projects: [
      {
        extends: true,
        test: {
          ...base,
          name: 'web',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: FEATURES.map((f) => `src/features/${f.name}/**`),
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      ...FEATURES.map((f) => ({
        extends: true,
        test: {
          ...base,
          name: f.name,
          include: [`src/features/${f.name}/**/*.test.{ts,tsx}`],
          setupFiles: [`./src/features/${f.name}/test/setup.ts`],
          testTimeout: f.testTimeout,
        },
      })),
    ],
  },
});
