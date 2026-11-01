import type { Metadata } from 'next';
import { TrackerScreen } from '@/features/jobs/screens';

export const metadata: Metadata = { title: 'Tracker' };

export default function TrackerPage() {
  return <TrackerScreen />;
}
