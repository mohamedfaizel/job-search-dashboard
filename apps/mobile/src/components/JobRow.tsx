import type { Job } from '@jobsearch/data';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { colors, fitColors } from '../lib/theme';

const WORKPLACE = { REMOTE: 'remote', HYBRID: 'hybrid', ONSITE: 'onSite' } as const;

/** One job: title, company and place, with its Fit % and a New badge. */
export const JobRow = memo(function JobRow({ job, isNew }: { job: Job; isNew: boolean }) {
  const t = useTranslations('Jobs');
  const place = [job.city, job.workplace ? t(WORKPLACE[job.workplace]) : null]
    .filter(Boolean)
    .join(' · ');
  const fit = job.fitScore === null ? null : fitColors(job.fitScore);
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <View style={styles.titleLine}>
          {isNew && (
            <Text style={styles.new} accessibilityLabel={t('new')}>
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
      </View>
      {fit && job.fitScore !== null ? (
        <Text style={[styles.fit, { color: fit.fg, backgroundColor: fit.bg }]}>
          {t('fit', { score: job.fitScore })}
        </Text>
      ) : (
        <Text style={styles.noFit}>{t('noFit')}</Text>
      )}
    </View>
  );
});

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
  main: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  new: {
    backgroundColor: colors.gold,
    color: colors.black,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  company: { fontSize: 14, color: colors.text },
  place: { fontSize: 13, color: colors.muted },
  fit: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  noFit: { fontSize: 12, color: colors.muted },
});
