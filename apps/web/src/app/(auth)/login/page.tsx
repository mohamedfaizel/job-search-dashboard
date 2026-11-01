import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  // useSearchParams (for ?next=) needs a Suspense boundary so the rest can be pre-rendered.
  return (
    <Suspense>
      <AuthForm mode="log-in" />
    </Suspense>
  );
}
