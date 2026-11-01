import type { Metadata } from 'next';
import { MovingSoon } from '@/components/MovingSoon';

export const metadata: Metadata = { title: 'Add jobs' };

export default function AddJobsPage() {
  return <MovingSoon title="Add jobs" />;
}
