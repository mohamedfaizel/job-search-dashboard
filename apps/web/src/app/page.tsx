import { cookies } from 'next/headers';
import { IntroPage } from '@/features/site/IntroPage';
import { SESSION_COOKIE } from '@/proxy';

/**
 * The intro page for visitors who are not logged in. Logged-in visitors never see it: the
 * proxy sends them straight to My Jobs.
 */
export default async function Home() {
  const loggedIn = (await cookies()).has(SESSION_COOKIE);
  return <IntroPage loggedIn={loggedIn} />;
}
