import type { Metadata } from 'next';
import { WelcomePage } from '@/features/welcome/WelcomePage';

export const metadata: Metadata = { title: 'Welcome' };

/** The first-login steps: your job data key, then your resume. */
export default function Welcome() {
  return <WelcomePage />;
}
