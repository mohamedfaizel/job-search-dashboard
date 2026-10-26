import type { StorybookConfig } from '@storybook/react-vite';

// Storybook is a catalogue of the UI components from every microfrontend. It runs on its own
// (no API, no database), and Chromatic snapshots each story to catch visual changes in PRs.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../stories/**/*.stories.tsx'],
  // Tailwind and React come from ./vite.config.ts, which Storybook picks up automatically.
};

export default config;
