import '@testing-library/jest-dom/vitest';
import { location } from './navigation';
import { server, session } from './server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  session.user = null;
  vi.clearAllMocks();
  location.pathname = '/jobs';
  location.search = new URLSearchParams();
});
afterAll(() => {
  server.close();
});
