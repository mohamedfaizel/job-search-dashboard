import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Components are tested in jsdom against a fake API (MSW).
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // `pnpm test:coverage` writes coverage/lcov.info for SonarCloud, with paths from the repo root.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', ['lcov', { projectRoot: '../..' }]],
      include: ['src/**'],
    },
  },
});
