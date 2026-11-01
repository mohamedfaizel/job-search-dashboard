import type { Metadata } from 'next';
import { MovingSoon } from '@/components/MovingSoon';

export const metadata: Metadata = { title: 'Job posts' };

export default function JobsPage() {
  return <MovingSoon title="Job posts" />;
}
