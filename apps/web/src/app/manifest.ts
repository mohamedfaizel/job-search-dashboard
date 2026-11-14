import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/lib/app-name';

/**
 * The web app manifest (served at /manifest.webmanifest). It tells a phone or desktop browser
 * the app's name, icons and colours, so "Install app" puts it on the home screen and it opens
 * in its own window, without the browser's address bar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: 'Job Hunter',
    description: 'Track jobs, your applications and your profile.',
    id: '/',
    start_url: '/jobs',
    scope: '/',
    display: 'standalone',
    background_color: '#f1f5f9',
    theme_color: '#0b0b0b',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'My Jobs', url: '/jobs' },
      { name: 'Tracker', url: '/tracker' },
      { name: 'Job Market', url: '/jobs/add' },
    ],
  };
}
