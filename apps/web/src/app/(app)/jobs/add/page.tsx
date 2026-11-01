import type { Metadata } from 'next';
import { AddJobsPage } from '@/features/add-jobs/AddJobsPage';

export const metadata: Metadata = { title: 'Add jobs' };

export default function AddJobs() {
  return <AddJobsPage />;
}
