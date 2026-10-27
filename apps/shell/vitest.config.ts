import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Tests run without Module Federation: each app is tested on its own.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'dashboard/App': fileURLToPath(new URL('./src/test/dashboard-app.tsx', import.meta.url)),
      'dashboard/Tracker': fileURLToPath(new URL('./src/test/tracker-app.tsx', import.meta.url)),
      'jobForm/App': fileURLToPath(new URL('./src/test/job-form-app.tsx', import.meta.url)),
      'profile/App': fileURLToPath(new URL('./src/test/profile-app.tsx', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
