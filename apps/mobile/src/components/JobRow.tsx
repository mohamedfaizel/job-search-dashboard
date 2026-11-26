import type { Job } from '@jobsearch/data';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { colors, fitColors } from '../lib/theme';

const WORKPLACE = { REMOTE: 'remote', HYBRID: 'hybrid', ONSITE: 'onSite' } as const;

/** "Berlin · Hybrid": the city and how you work there, as far as the ad says. */
export function placeOf(
  job: Pick<Job, 'city' | 'workplace'>,
  t: (key: (typeof WORKPLACE)[keyof typeof WORKPLACE]) => string,
): string {
  return [job.city, job.workplace ? t(WORKPLACE[job.workplace]) : null].filter(Boolean).join(' · ');
}

/**
 * Fit % in the website's colours, or a grey dash before there is one. A guess from the title
 * (the ad has no text) is grey with a "~".
 */
export function FitPill({ score, estimate = false }: { score: number | null; estimate?: boolean }) {
  const t = useTranslations('Jobs');
  if (score === null) return <Text style={styles.noFit}>{t('noFit')}</Text>;
  if (estimate) return <Text style={styles.noFit}>{t('fitGuess', { score })}</Text>;
  const fit = fitColors(score);
  return (
    <Text style={[styles.fit, { color: fit.fg, backgroundColor: fit.bg }]}>
      {t('fit', { score })}
    </Text>
  );
}

/** One job: title, company and place, with its Fit %, a New badge and your tracker status. */
export const JobRow = memo(function JobRow({ job, isNew }: { job: Job; isNew: boolean }) {
  const t = useTranslations('Jobs');
  const tStatus = useTranslations('Status');
  const place = placeOf(job, t);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t('openHint')}
      onPress={() => {
        router.push(`/job/${job.id}`);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <View style={styles.titleLine}>
          {isNew && (
            <Text style={styles.new} numberOfLines={1}>
              {t('new')}
            </Text>
          )}
          <Text style={styles.title} numberOfLines={2}>
            {job.title}
          </Text>
        </View>
        <Text style={styles.company} numberOfLines={1}>
          {job.company.name}
        </Text>
        {place !== '' && <Text style={styles.place}>{place}</Text>}
        {job.applicationStatus !== 'NONE' && (
          <Text style={styles.status}>{tStatus(job.applicationStatus)}</Text>
        )}
      </View>
      <FitPill score={job.fitScore} estimate={job.fitEstimate} />
    </Pressable>
  );
});

const pill = {
  fontSize: 11,
  fontWeight: '700',
  paddingHorizontal: 6,
  paddingVertical: 1,
  borderRadius: 999,
  overflow: 'hidden',
} as const;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.page },
  main: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  // Never squeezed by a long title: on small phones it broke into "Ne / w".
  new: { ...pill, flexShrink: 0, backgroundColor: colors.gold, color: colors.black },
  status: { ...pill, alignSelf: 'flex-start', backgroundColor: colors.black, color: colors.gold },
  company: { fontSize: 14, color: colors.text },
  place: { fontSize: 13, color: colors.muted },
  fit: { ...pill, fontSize: 13, paddingHorizontal: 8, paddingVertical: 3 },
  noFit: { fontSize: 12, color: colors.muted },
});
