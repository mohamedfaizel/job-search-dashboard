import { registerPushToken, unregisterPushToken } from '@jobsearch/data';
import * as Notifications from 'expo-notifications';
import { forgetThisPhone, registerThisPhone } from './push';

const mockConfig: { expoConfig: { extra?: unknown } | null; easConfig: unknown } = {
  expoConfig: null,
  easConfig: null,
};
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockConfig.expoConfig;
    },
    get easConfig() {
      return mockConfig.easConfig;
    },
  },
}));
jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[phone1]' })),
}));
jest.mock('@jobsearch/data', () => ({
  registerPushToken: jest.fn(() => Promise.resolve(true)),
  unregisterPushToken: jest.fn(() => Promise.resolve(true)),
}));

afterEach(() => {
  jest.clearAllMocks();
  mockConfig.expoConfig = null;
});

describe('push', () => {
  it('does nothing until the app has an EAS project id', async () => {
    expect(await registerThisPhone()).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('registers this phone, and forgets it on log out', async () => {
    mockConfig.expoConfig = { extra: { eas: { projectId: 'p-1' } } };
    expect(await registerThisPhone()).toBe('ExponentPushToken[phone1]');
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'p-1' });
    expect(registerPushToken).toHaveBeenCalledWith('ExponentPushToken[phone1]');

    await forgetThisPhone();
    expect(unregisterPushToken).toHaveBeenCalledWith('ExponentPushToken[phone1]');
    await forgetThisPhone();
    expect(unregisterPushToken).toHaveBeenCalledTimes(1);
  });
});
