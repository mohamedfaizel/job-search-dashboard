import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Providers } from '../lib/Providers';
import { colors } from '../lib/theme';

/** Every screen: black bar with gold title, like the website's header. */
export default function RootLayout() {
  return (
    <Providers>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.black },
          headerTintColor: colors.gold,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.page },
        }}
      />
    </Providers>
  );
}
