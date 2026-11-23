import { cookies } from 'next/headers';
import { IntroPage } from '@/features/site/IntroPage';
import { SESSION_COOKIE } from '@/proxy';

/**
 * The intro page. Anyone can open it; logged in, its header offers Open My Jobs, and the app's
 * footer links to it (How it works, Features).
 */
export default async function Home() {
  const loggedIn = (await cookies()).has(SESSION_COOKIE);
  return <IntroPage loggedIn={loggedIn} />;
}
