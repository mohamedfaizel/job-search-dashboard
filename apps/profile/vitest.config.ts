import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Tests run without Module Federation: each app is tested on its own.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // The profile page is a big form, and CI runs every app's tests at once on 2 CPUs, so a
    // test that takes under 1 s here can pass 5 s there (the default limit).
    testTimeout: 15_000,
  },
});
