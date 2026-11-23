import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { MAKER } from '../lib/maker';
import { colors } from '../lib/theme';

/**
 * "Made by Mohamed Faizel" with the round photo, and a link for questions and ideas: the same
 * line as the bottom of every website page. The link opens the message window. It closes the
 * screens you see logged in: the job list, a job and the notifications.
 */
export function MakerLine() {
  const t = useTranslations('Maker');
  return (
    <View style={styles.line}>
      <Text style={styles.madeBy}>{t('madeBy', { name: MAKER.name })}</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityHint={t('opensWindow')}
        hitSlop={8}
        onPress={() => {
          router.push('/messages');
        }}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Image source={MAKER.face} style={styles.face} accessibilityIgnoresInvertColors />
        <Text style={styles.linkText}>{t('queries')} ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 16,
    rowGap: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  // Slate 600, as on the website: readable on the light grey page.
  madeBy: { fontSize: 14, color: '#475569' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  pressed: { opacity: 0.6 },
  face: { width: 24, height: 24, borderRadius: 12 },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.black },
});
