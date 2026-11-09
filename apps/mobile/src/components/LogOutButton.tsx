import { useLogOut } from '@jobsearch/data';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useTranslations } from 'use-intl';
import { colors } from '../lib/theme';

export function LogOutButton() {
  const t = useTranslations('Auth');
  const logOut = useLogOut();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      style={{ paddingHorizontal: 8 }}
      onPress={() => {
        logOut.mutate(undefined, {
          onSuccess: () => {
            router.replace('/login');
          },
        });
      }}
    >
      <Text style={{ color: colors.gold, fontSize: 15 }}>{t('logOut')}</Text>
    </Pressable>
  );
}
