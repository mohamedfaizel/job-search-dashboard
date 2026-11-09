import { useNotifications } from '@jobsearch/data';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslations } from 'use-intl';
import { colors } from '../lib/theme';

/** The 🔔 in the black bar, with a red count of unread notifications. Opens the list. */
export function BellButton() {
  const t = useTranslations('Alerts');
  const unread = useNotifications().data?.unread ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? t('bellUnread', { count: unread }) : t('bell')}
      hitSlop={8}
      style={styles.bell}
      onPress={() => {
        router.push('/alerts');
      }}
    >
      <Text style={styles.icon}>🔔</Text>
      {unread > 0 && <Text style={styles.count}>{unread > 99 ? '99+' : unread}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  icon: { fontSize: 18 },
  count: {
    marginLeft: -6,
    marginTop: -12,
    minWidth: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: colors.red,
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
