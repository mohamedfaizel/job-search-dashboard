import type { Metadata } from 'next';
import { SettingsPage } from '@/features/settings/SettingsPage';

export const metadata: Metadata = { title: 'Settings' };

/** A server component page that shows the client-side Settings screen. */
export default function Settings() {
  return <SettingsPage />;
}
