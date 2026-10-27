import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The shell is the "host": it owns the page layout and loads each microfrontend at runtime.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const dashboardUrl = env['VITE_DASHBOARD_URL'] ?? 'http://localhost:5174';
  const jobFormUrl = env['VITE_JOB_FORM_URL'] ?? 'http://localhost:5175';
  const profileUrl = env['VITE_PROFILE_URL'] ?? 'http://localhost:5176';

  return {
    plugins: [
      react(),
      tailwindcss(),
      federation({
        name: 'shell',
        remotes: {
          dashboard: {
            type: 'module',
            name: 'dashboard',
            entry: `${dashboardUrl}/remoteEntry.js`,
          },
          jobForm: {
            type: 'module',
            name: 'jobForm',
            entry: `${jobFormUrl}/remoteEntry.js`,
          },
          profile: {
            type: 'module',
            name: 'profile',
            entry: `${profileUrl}/remoteEntry.js`,
          },
        },
        // Remote types are declared by hand in the shell (src/remotes.d.ts).
        dts: false,
        shared: {
          react: { singleton: true },
          'react-dom': { singleton: true },
          // One copy of the data layer, so every microfrontend shares the Redux store and query cache.
          '@jobsearch/data': { singleton: true },
          '@tanstack/react-query': { singleton: true },
          'react-redux': { singleton: true },
          '@reduxjs/toolkit': { singleton: true },
        },
      }),
    ],
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true },
    build: { target: 'esnext' },
  };
});
