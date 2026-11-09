import { useMe } from '@jobsearch/data';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { BellButton } from '../components/BellButton';
import { JobList } from '../components/JobList';
import { LogOutButton } from '../components/LogOutButton';
import { PhoneAlerts } from '../components/PhoneAlerts';
import { colors } from '../lib/theme';

/** The job list, once you are logged in, with the 🔔 and phone alerts. */
export default function JobsScreen() {
  const t = useTranslations('Jobs');
  const me = useMe();
  if (me.isPending) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }
  if (!me.data) return <Redirect href="/login" />;
  return (
    <>
      <Stack.Screen
        options={{
          title: t('title'),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <BellButton />
              <LogOutButton />
            </View>
          ),
        }}
      />
      <PhoneAlerts />
      <JobList />
    </>
  );
}
