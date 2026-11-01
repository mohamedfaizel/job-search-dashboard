import '@testing-library/jest-dom/vitest';
import { location } from './navigation';
import { savedLocales, server, session } from './server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  session.user = null;
  savedLocales.length = 0;
  document.cookie = 'locale=; max-age=0; path=/';
  vi.clearAllMocks();
  location.pathname = '/jobs';
  location.search = new URLSearchParams();
});
afterAll(() => {
  server.close();
});
