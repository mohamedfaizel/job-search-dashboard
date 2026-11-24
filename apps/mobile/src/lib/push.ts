import { registerPushToken, unregisterPushToken } from '@jobsearch/data';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

/** This phone's push token once it is registered, so log out can take it back. */
let current: string | null = null;

/**
 * The app's EAS project id. Expo push tokens need it: run `npx eas init` once in apps/mobile to
 * add it. Without it the phone still shows alerts while the app is open, but gets no pushes.
 */
export function easProjectId(): string | null {
  const config = Constants as {
    expoConfig?: { extra?: { eas?: { projectId?: unknown } } } | null;
    easConfig?: { projectId?: unknown } | null;
  };
  const id = config.expoConfig?.extra?.eas?.projectId ?? config.easConfig?.projectId;
  return typeof id === 'string' && id ? id : null;
}

/**
 * Asks Expo for this phone's push token and tells the API, so the morning briefing reaches the
 * lock screen even when the app is closed. Call it after notifications are allowed.
 */
export async function registerThisPhone(): Promise<string | null> {
  const projectId = easProjectId();
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushToken(data);
  current = data;
  return data;
}

/** Log out: this phone gets no more pushes for the user who leaves. Never throws. */
export async function forgetThisPhone(): Promise<void> {
  if (!current) return;
  const token = current;
  current = null;
  await unregisterPushToken(token).catch(() => false);
}
