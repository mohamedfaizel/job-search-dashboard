import '@testing-library/jest-dom/vitest';
import { applications, hiddenIds, requests, server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
  hiddenIds.clear();
  applications.length = 0;
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
