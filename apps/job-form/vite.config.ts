import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const PORT = 5175;

// The job form is a "remote": it exposes its App so the shell can load it at runtime.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'jobForm',
      filename: 'remoteEntry.js',
      exposes: { './App': './src/App.tsx' },
      // Remote types are declared by hand in the shell (src/remotes.d.ts).
      dts: false,
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
  server: { port: PORT, strictPort: true, origin: `http://localhost:${PORT}` },
  preview: { port: PORT, strictPort: true },
  build: { target: 'esnext' },
});
