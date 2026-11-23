import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslations } from 'use-intl';
import { colors } from '../lib/theme';

/**
 * The ? in the black bar, next to the 🔔: opens Queries and suggestions, where you write to the
 * maker and read the answers. It took the place of the line under the lists.
 */
export function HelpButton() {
  const t = useTranslations('Maker');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('help')}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={() => {
        router.push('/messages');
      }}
    >
      <Text style={styles.icon}>?</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 26,
    height: 26,
    marginHorizontal: 6,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  icon: { fontSize: 14, fontWeight: '800', color: colors.gold },
});
