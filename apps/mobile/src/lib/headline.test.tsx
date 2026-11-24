import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { IntlProvider } from 'use-intl';
import en from '../i18n/en.json';
import { notification } from '../test/fakeApi';
import { useHeadline } from './alerts';

async function headline() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlProvider locale="en" messages={en} timeZone="UTC">
      {children}
    </IntlProvider>
  );
  const { result } = await renderHook(() => useHeadline(), { wrapper });
  return result.current;
}

const none = { newJobs: 0, kits: 0, followUps: 0, interviews: 0, replies: 0 };

describe('useHeadline', () => {
  it('sums up the morning briefing', async () => {
    const say = await headline();
    expect(
      say(
        notification({
          id: 1,
          kind: 'BRIEFING',
          briefing: { newJobs: 2, kits: 1, interviews: 1, followUps: 3, replies: 1 },
        }),
      ),
    ).toBe(
      'Good morning: 2 new jobs, 1 kit ready, 1 interview today, 3 follow-ups due, 1 employer reply',
    );
    expect(say(notification({ id: 1, kind: 'BRIEFING', briefing: none }))).toBe('Good morning');
  });

  it('sums up the weekly report', async () => {
    const say = await headline();
    const weekly = {
      applied: 3,
      replies: 1,
      interviews: 1,
      newJobs: 9,
      goodJobs: 2,
      best: null,
      pause: null,
    };
    expect(say(notification({ id: 1, kind: 'WEEKLY_REPORT', weekly }))).toBe(
      'Your week: 3 applied, 1 reply, 2 good jobs',
    );
  });

  it('names the apply kits and autopilot', async () => {
    const say = await headline();
    expect(say(notification({ id: 1, kind: 'KITS_READY', count: 2 }))).toBe(
      '2 apply kits are ready to check',
    );
    expect(say(notification({ id: 1, kind: 'KITS_FAILED' }))).toBe('Apply kits were not written');
    expect(say(notification({ id: 1, kind: 'AUTOPILOT', searchName: 'Data', count: 1 }))).toBe(
      'Autopilot for “Data”: 1 job queued',
    );
  });
});
