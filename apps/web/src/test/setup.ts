import '@testing-library/jest-dom/vitest';
import { location } from './navigation';
import { keyPool, savedLocales, server, session, signup } from './server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  session.user = null;
  signup.mode = 'OPEN';
  signup.invites = [];
  signup.sent = [];
  savedLocales.length = 0;
  keyPool.sent = [];
  keyPool.pool = { ...keyPool.pool, free: 0, assigned: 0, empty: 0, keys: [], requests: [] };
  document.cookie = 'locale=; max-age=0; path=/';
  vi.clearAllMocks();
  location.pathname = '/jobs';
  location.search = new URLSearchParams();
});
afterAll(() => {
  server.close();
});
