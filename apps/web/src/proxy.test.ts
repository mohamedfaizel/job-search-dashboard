import { NextRequest } from 'next/server';
import { proxy, SESSION_COOKIE } from './proxy';

function request(path: string, loggedIn: boolean) {
  const req = new NextRequest(new URL(path, 'http://localhost:3001'));
  if (loggedIn) req.cookies.set(SESSION_COOKIE, 'token');
  return req;
}

/** Where the response sends the browser, or null when the page just loads. */
function redirectedTo(path: string, loggedIn: boolean): string | null {
  const location = proxy(request(path, loggedIn)).headers.get('location');
  return location ? location.replace('http://localhost:3001', '') : null;
}

describe('proxy', () => {
  it('sends a logged-out visitor to /login and remembers the page', () => {
    expect(redirectedTo('/tracker?status=APPLIED', false)).toBe(
      '/login?next=%2Ftracker%3Fstatus%3DAPPLIED',
    );
    expect(redirectedTo('/', false)).toBe('/login');
  });

  it('lets a logged-out visitor open the login and sign-up pages', () => {
    expect(redirectedTo('/login', false)).toBeNull();
    expect(redirectedTo('/signup', false)).toBeNull();
  });

  it('lets a logged-in visitor through', () => {
    expect(redirectedTo('/profile', true)).toBeNull();
  });

  it('skips the login page when already logged in', () => {
    expect(redirectedTo('/login', true)).toBe('/jobs');
    expect(redirectedTo('/login?next=/tracker', true)).toBe('/tracker');
    expect(redirectedTo('/login?next=https://evil.example', true)).toBe('/jobs');
  });
});
