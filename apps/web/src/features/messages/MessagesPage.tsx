'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { MAKER } from '@/lib/maker';
import { Conversation, MakerHeader } from './MessageWindow';

/**
 * Queries and suggestions: the ? in the header opens it. The same conversation as the message
 * window, on a page of its own.
 */
export function MessagesPage() {
  const t = useTranslations('Messages');
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="mx-auto flex h-[calc(100vh-12rem)] min-h-[28rem] max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <MakerHeader
        titleId={titleId}
        title={t('pageTitle')}
        sub={t('pageWho', { name: MAKER.name })}
        page
      />
      <Conversation />
    </section>
  );
}
