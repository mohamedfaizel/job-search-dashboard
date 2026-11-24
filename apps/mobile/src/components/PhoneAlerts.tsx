import type { AppNotification } from '@jobsearch/data';
import { useNotifications } from '@jobsearch/data';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useTranslations } from 'use-intl';
import { alertLink, freshAlerts, useHeadline } from '../lib/alerts';
import { registerThisPhone } from '../lib/push';

/** Android shows alerts through a channel you can turn off in the phone's settings. */
const CHANNEL = 'alerts';

// Show an alert even while the app is open, like a message from any other app.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
  });
}

/** "Data Engineer · HelloFresh · 82%": the best jobs, one per line. */
function jobLines(item: AppNotification): string {
  return item.jobs
    .slice(0, 3)
    .map((job) =>
      [job.title, job.company, item.kind === 'INTERVIEW_SOON' ? null : `${job.fit}%`]
        .filter(Boolean)
        .join(' · '),
    )
    .join('\n');
}

/**
 * Phone alerts: while you are logged in, the app asks for notifications every minute (the same
 * as the website's 🔔). A new one pops up on the phone, the app icon shows the unread count, and
 * tapping the alert opens it. What was already there when the app opened only shows in the 🔔.
 */
export function PhoneAlerts() {
  // Browsers (the web preview) have no phone alerts; the 🔔 still works there.
  return Platform.OS === 'web' ? null : <NativeAlerts />;
}

function NativeAlerts() {
  const t = useTranslations('Alerts');
  const headline = useHeadline();
  const list = useNotifications();
  const seen = useRef<Set<number> | null>(null);
  const tapped = Notifications.useLastNotificationResponse();

  useEffect(() => {
    void (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: t('channel'),
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const { granted } = await Notifications.getPermissionsAsync();
      const allowed = granted || (await Notifications.requestPermissionsAsync()).granted;
      // Real pushes (the morning briefing) also reach the phone when the app is closed.
      if (allowed) await registerThisPhone();
    })().catch(() => undefined);
  }, [t]);

  useEffect(() => {
    const url: unknown = tapped?.notification.request.content.data?.['url'];
    if (typeof url === 'string') router.push(url);
  }, [tapped]);

  useEffect(() => {
    const data = list.data;
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.items.map((item) => item.id));
    } else {
      for (const item of freshAlerts(data.items, seen.current)) {
        seen.current.add(item.id);
        void Notifications.scheduleNotificationAsync({
          content: {
            title: headline(item),
            body: item.kind === 'MESSAGE_REPLY' ? t('messageHint') : jobLines(item),
            data: { url: alertLink(item) },
          },
          trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
        }).catch(() => undefined);
      }
    }
    void Notifications.setBadgeCountAsync(data.unread).catch(() => undefined);
  }, [list.data, headline, t]);

  return null;
}
