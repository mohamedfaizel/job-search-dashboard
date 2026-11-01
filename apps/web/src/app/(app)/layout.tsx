import type { ReactNode } from 'react';
import { AppFrame } from '@/components/AppFrame';

/**
 * Pages in the (app) folder need you to be logged in. The brackets mean the folder name is
 * not part of the URL: app/(app)/jobs/page.tsx is /jobs.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
