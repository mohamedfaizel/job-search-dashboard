import '@testing-library/jest-dom/vitest';
import {
  gmail,
  myDesign,
  otherResumes,
  requests,
  savedAnswers,
  server,
  syncs,
  wordTemplate,
} from './server';

// jsdom doesn't lay out pages, so it has no scrollIntoView.
Element.prototype.scrollIntoView = () => undefined;

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
  syncs.length = 0;
  otherResumes.length = 0;
  savedAnswers.length = 0;
  Object.assign(gmail, { configured: true, accounts: [], found: 0 });
  window.history.replaceState(null, '', '/');
  wordTemplate.current = null;
  myDesign.current = null;
  // The profile page remembers its open tab; start each test on the first one.
  localStorage.clear();
});
afterAll(() => {
  server.close();
});
