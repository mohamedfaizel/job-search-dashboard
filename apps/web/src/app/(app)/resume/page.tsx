import type { Metadata } from 'next';
import { ResumeBuilderPage } from '@/features/resume/ResumeBuilderPage';

export const metadata: Metadata = { title: 'Resume' };

/** A server component page that shows the client-side Resume builder. */
export default function Resume() {
  return <ResumeBuilderPage />;
}
