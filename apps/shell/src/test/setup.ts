import '@testing-library/jest-dom/vitest';
import { server, session } from './server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  session.user = null;
});
afterAll(() => {
  server.close();
});
