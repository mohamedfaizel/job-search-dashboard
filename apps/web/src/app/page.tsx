import { redirect } from 'next/navigation';

/** The home page is the job list. */
export default function Home() {
  redirect('/jobs');
}
