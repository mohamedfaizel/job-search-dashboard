import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { requests, server } from './server';

// Turbo runs every package's tests at once, so on a busy CI runner a query can take longer than
// findBy*'s 1 s default. Same setting as the dashboard's tests.
configure({ asyncUtilTimeout: 5000 });

// jsdom doesn't lay out pages, so it has no scrollIntoView.
Element.prototype.scrollIntoView = () => undefined;

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
});
afterAll(() => {
  server.close();
});
