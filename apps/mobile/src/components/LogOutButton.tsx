import { useLogOut } from '@jobsearch/data';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useTranslations } from 'use-intl';
import { forgetThisPhone } from '../lib/push';
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
        // While still logged in: the server only lets you remove your own phone.
        void forgetThisPhone().finally(() => {
          logOut.mutate(undefined, {
            onSuccess: () => {
              router.replace('/login');
            },
          });
        });
      }}
    >
      <Text style={{ color: colors.gold, fontSize: 15 }}>{t('logOut')}</Text>
    </Pressable>
  );
}
