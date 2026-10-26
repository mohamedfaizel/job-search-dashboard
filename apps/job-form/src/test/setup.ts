import '@testing-library/jest-dom/vitest';
import { requests, server } from './server';

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
