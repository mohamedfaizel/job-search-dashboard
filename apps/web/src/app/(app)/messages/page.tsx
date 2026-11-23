import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MessagesPage } from '@/features/messages/MessagesPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Messages');
  return { title: t('pageTitle') };
}

/** Queries and suggestions: write to the maker, and read the answers. */
export default function Messages() {
  return <MessagesPage />;
}
