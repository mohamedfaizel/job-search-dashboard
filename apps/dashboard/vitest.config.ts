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
  },
});
