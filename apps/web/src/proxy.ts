import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { safeNextPath } from './lib/safe-next';

/** The httpOnly cookie the API sets when you log in (apps/api/src/auth/session.ts). */
export const SESSION_COOKIE = 'session';

const AUTH_PAGES = new Set(['/login', '/signup']);

/**
 * Runs on the server before a page renders. It only checks that the session cookie is there:
 * the API still checks that the cookie is valid on every request. If it has expired, the page
 * sends you to /login itself (see AppFrame).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const loggedIn = request.cookies.has(SESSION_COOKIE);

  if (AUTH_PAGES.has(pathname)) {
    if (!loggedIn) return NextResponse.next();
    // Already logged in: skip the login page.
    const next = safeNextPath(request.nextUrl.searchParams.get('next'));
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (loggedIn) return NextResponse.next();
  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Every page, but not Next's own files (_next), the favicon or other files with a dot.
  matcher: ['/((?!_next/|favicon.ico|.*\\..*).*)'],
};
