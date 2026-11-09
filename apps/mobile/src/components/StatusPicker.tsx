import type { ApplicationStatus } from '@jobsearch/data';
import { APPLICATION_STATUSES } from '@jobsearch/data';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { colors } from '../lib/theme';

/** Your tracker status as a row of chips; tap one to move the job on your board. */
export function StatusPicker({
  value,
  busy,
  onChange,
}: {
  value: ApplicationStatus;
  busy: boolean;
  onChange: (status: ApplicationStatus) => void;
}) {
  const t = useTranslations('Status');
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('label')} style={styles.row}>
      {APPLICATION_STATUSES.map((status) => {
        const on = status === value;
        return (
          <Pressable
            key={status}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: busy }}
            disabled={busy || on}
            onPress={() => {
              onChange(status);
            }}
            style={[styles.chip, on && styles.on]}
          >
            <Text style={[styles.text, on && styles.onText]}>{t(status)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  on: { backgroundColor: colors.black, borderColor: colors.black },
  text: { fontSize: 14, color: colors.text },
  onText: { color: colors.gold, fontWeight: '700' },
});
