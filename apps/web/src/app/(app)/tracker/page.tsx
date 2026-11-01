import type { Metadata } from 'next';
import { MovingSoon } from '@/components/MovingSoon';

export const metadata: Metadata = { title: 'Tracker' };

export default function TrackerPage() {
  return <MovingSoon title="Tracker" />;
}
