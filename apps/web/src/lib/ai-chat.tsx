'use client';

import type { AiProvider } from '@jobsearch/data';
import { useMe } from '@jobsearch/data';
import type { AbstractIntlMessages } from 'next-intl';
import { NextIntlClientProvider, useLocale, useMessages, useTimeZone } from 'next-intl';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

/** The AI chat each provider's copy-and-open buttons open (Settings > API keys picks one). */
export const AI_CHATS: Record<AiProvider, { name: string; url: string }> = {
  ANTHROPIC: { name: 'Claude', url: 'https://claude.ai/new' },
  OPENAI: { name: 'ChatGPT', url: 'https://chatgpt.com/' },
};

/** Your AI chat: its name for the texts and the page the copy-and-open buttons open. */
export function useAiChat(): { name: string; url: string } {
  const { data: user } = useMe();
  return AI_CHATS[user?.aiProvider ?? 'ANTHROPIC'];
}

/** Every text with {ai} gets the chat's name ("Paste {ai}’s reply" → "Paste ChatGPT’s reply"). */
export function withAiName(messages: AbstractIntlMessages, name: string): AbstractIntlMessages {
  const named: AbstractIntlMessages = {};
  for (const [key, value] of Object.entries(messages)) {
    named[key] =
      typeof value === 'string' ? value.replaceAll('{ai}', name) : withAiName(value, name);
  }
  return named;
}

/**
 * Fills {ai} in all texts below it once, so no component has to pass the chat's name to each
 * text. The app frame puts it around every logged-in page.
 */
export function AiNameIntl({ children }: { children: ReactNode }) {
  const messages = useMessages();
  const locale = useLocale();
  const timeZone = useTimeZone();
  const { name } = useAiChat();
  const named = useMemo(() => withAiName(messages, name), [messages, name]);
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={named}
      {...(timeZone === undefined ? {} : { timeZone })}
    >
      {children}
    </NextIntlClientProvider>
  );
}
