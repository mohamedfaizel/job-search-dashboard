'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { openMessageWindow } from '@/lib/message-window';
import { MessageWindow } from './MessageWindow';

/** Where a visitor goes to log in first: back to About us, with the window open. */
export const LOGIN_TO_MESSAGE = `/login?next=${encodeURIComponent('/about?message=1')}`;

/**
 * Opens the message window when you are logged in. A visitor has to log in first, so for them
 * it is a link to the login page that comes back with the window open.
 */
export function MessageOpener({
  loggedIn,
  className,
  children,
}: {
  loggedIn: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!loggedIn) {
    return (
      <Link href={LOGIN_TO_MESSAGE} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={openMessageWindow} className={className}>
      {children}
    </button>
  );
}

/**
 * The message window for a page, once. `?message=1` in the address opens it, so the login page
 * can send you back to it.
 */
export function MessageWindowHost() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('message') !== '1') return;
    openMessageWindow();
    url.searchParams.delete('message');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);
  return <MessageWindow />;
}
