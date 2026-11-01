import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth');
  return { title: t('logInTitle') };
}

export default function LoginPage() {
  // useSearchParams (for ?next=) needs a Suspense boundary so the rest can be pre-rendered.
  return (
    <Suspense>
      <AuthForm mode="log-in" />
    </Suspense>
  );
}
