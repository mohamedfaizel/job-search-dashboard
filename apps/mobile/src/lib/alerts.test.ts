import { notification } from '../test/fakeApi';
import { alertLink, freshAlerts } from './alerts';

describe('freshAlerts', () => {
  it('keeps only unread notifications not seen before', () => {
    const items = [
      notification({ id: 1 }),
      notification({ id: 2 }),
      notification({ id: 3, readAt: '2026-11-09T09:00:00.000Z' }),
    ];
    expect(freshAlerts(items, new Set([1])).map((item) => item.id)).toEqual([2]);
  });
});

describe('alertLink', () => {
  it('opens the job for an interview and the list for new jobs', () => {
    expect(alertLink(notification({ id: 1, kind: 'INTERVIEW_SOON' }))).toBe('/job/5');
    expect(alertLink(notification({ id: 1 }))).toBe('/alerts');
    expect(alertLink(notification({ id: 1, kind: 'INTERVIEW_SOON', jobs: [] }))).toBe('/alerts');
  });

  it('opens the message window for an answer to your message', () => {
    expect(alertLink(notification({ id: 1, kind: 'MESSAGE_REPLY', jobs: [] }))).toBe('/messages');
  });
});
