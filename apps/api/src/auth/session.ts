import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'session';
export const SESSION_DAYS = 7;

/**
 * httpOnly: page JavaScript can't read it, so an XSS bug can't steal the session.
 * sameSite lax: other sites can't make the browser send it with their requests.
 * secure: HTTPS only once deployed (localhost is plain HTTP).
 */
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}
