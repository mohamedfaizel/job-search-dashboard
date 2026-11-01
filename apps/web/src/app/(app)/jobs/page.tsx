import type { Metadata } from 'next';
import { JobsScreen } from '@/features/jobs/screens';

export const metadata: Metadata = { title: 'Job posts' };

export default function JobsPage() {
  return <JobsScreen />;
}
