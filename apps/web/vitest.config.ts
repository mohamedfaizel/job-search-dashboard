import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };
const PROFILE = 'src/features/profile/**/*.test.{ts,tsx}';

// Components are tested in jsdom; Next's router is mocked where a test needs it.
// Each screen moved over from the old app keeps its own fake API (its own test/setup.ts),
// so it runs as its own Vitest project.
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          globals: true,
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [PROFILE],
          setupFiles: ['./src/test/setup.ts'],
          css: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'profile',
          globals: true,
          environment: 'jsdom',
          include: [PROFILE],
          setupFiles: ['./src/features/profile/test/setup.ts'],
          css: false,
          // A big form: on a busy CI runner a test can take a few seconds.
          testTimeout: 15_000,
        },
      },
    ],
  },
});
