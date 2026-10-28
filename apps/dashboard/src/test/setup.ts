import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { applications, hiddenIds, removedTerms, requests, server } from './server';

// The first render of the big jobs table can take over a second on a busy CI runner (turbo runs
// every package's tests at once), longer than findBy*'s 1 s default. Waiting longer only slows
// a test that is about to fail anyway.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
  hiddenIds.clear();
  applications.length = 0;
  removedTerms.length = 0;
  localStorage.clear();
});
afterAll(() => {
  server.close();
});

// jsdom doesn't implement <dialog> fully yet; give it the two methods we use.
Object.assign(HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) {
    this.open = true;
  },
  close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  },
});
