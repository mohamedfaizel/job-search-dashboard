import type { Metadata } from 'next';
import { JobsScreen } from '@/features/jobs/screens';

export const metadata: Metadata = { title: 'My Jobs' };

export default function JobsPage() {
  return <JobsScreen />;
}
