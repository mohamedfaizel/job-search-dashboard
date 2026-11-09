import { Stack } from 'expo-router';
import { useTranslations } from 'use-intl';
import { AlertList } from '../components/AlertList';

/** Your notifications, opened from the 🔔 or from a phone alert. */
export default function AlertsScreen() {
  const t = useTranslations('Alerts');
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <AlertList />
    </>
  );
}
