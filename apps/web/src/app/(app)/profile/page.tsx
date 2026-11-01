import type { Metadata } from 'next';
import { ProfilePage } from '@/features/profile/ProfilePage';

export const metadata: Metadata = { title: 'My profile' };

/** A server component page that shows the client-side profile screen. */
export default function Profile() {
  return <ProfilePage />;
}
