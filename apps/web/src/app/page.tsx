import { cookies } from 'next/headers';
import { IntroPage } from '@/features/site/IntroPage';
import { SESSION_COOKIE } from '@/proxy';

/**
 * The intro page. Anyone can open it; logged in, its header offers Open My Jobs, and the app's
 * i in the header opens it too, at /about.
 */
export default async function Home() {
  const loggedIn = (await cookies()).has(SESSION_COOKIE);
  return <IntroPage loggedIn={loggedIn} />;
}
