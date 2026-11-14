import type { Metadata } from 'next';
import { AddJobsPage } from '@/features/add-jobs/AddJobsPage';

export const metadata: Metadata = { title: 'Job Market' };

export default function AddJobs() {
  return <AddJobsPage />;
}
