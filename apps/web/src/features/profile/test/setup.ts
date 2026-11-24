import '@testing-library/jest-dom/vitest';
import {
  apiKeys,
  poolKey,
  gmail,
  kitRun,
  me,
  myDesign,
  otherResumes,
  requests,
  savedAnswers,
  server,
  stories,
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
  apiKeys.length = 0;
  kitRun.current = null;
  kitRun.steps = [];
  Object.assign(poolKey, {
    state: 'NONE',
    used: 0,
    poolEmpty: false,
    requestedAt: null,
    note: null,
    askAgainAt: null,
  });
  me.aiProvider = 'ANTHROPIC';
  syncs.length = 0;
  otherResumes.length = 0;
  savedAnswers.length = 0;
  stories.length = 0;
  Object.assign(gmail, { configured: true, accounts: [], found: 0, calendar: null });
  window.history.replaceState(null, '', '/');
  wordTemplate.current = null;
  myDesign.current = null;
  // The profile page remembers its open tab; start each test on the first one.
  localStorage.clear();
});
afterAll(() => {
  server.close();
});
