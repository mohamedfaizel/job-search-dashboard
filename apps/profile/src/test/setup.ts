import '@testing-library/jest-dom/vitest';
import { otherResumes, requests, server, syncs } from './server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
  syncs.length = 0;
  otherResumes.length = 0;
});
afterAll(() => {
  server.close();
});
