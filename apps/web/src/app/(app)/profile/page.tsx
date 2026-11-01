import type { Metadata } from 'next';
import { MovingSoon } from '@/components/MovingSoon';

export const metadata: Metadata = { title: 'My profile' };

export default function ProfilePage() {
  return <MovingSoon title="My profile" />;
}
