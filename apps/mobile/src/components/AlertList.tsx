import type { AppNotification } from '@jobsearch/data';
import { useMarkNotificationsRead, useNotifications } from '@jobsearch/data';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { useHeadline } from '../lib/alerts';
import { colors } from '../lib/theme';
import { useErrorText } from '../lib/useErrorText';
import { FitPill } from './JobRow';

/**
 * Your notifications, newest first: new jobs from scheduled searches and interview reminders.
 * Opening the list marks them read; the ones that were new keep a red dot until you leave.
 */
export function AlertList() {
  const t = useTranslations('Alerts');
  const errorText = useErrorText();
  const list = useNotifications();
  const { mutate: markRead } = useMarkNotificationsRead();
  const [wasUnread, setWasUnread] = useState<ReadonlySet<number> | null>(null);
  const items = list.data?.items;
  if (items && !wasUnread) {
    setWasUnread(new Set(items.filter((item) => item.readAt === null).map((item) => item.id)));
  }

  useEffect(() => {
    if (wasUnread && wasUnread.size > 0) markRead();
  }, [wasUnread, markRead]);

  if (list.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} accessibilityLabel={t('loading')} />
      </View>
    );
  }
  if (list.isError) {
    return (
      <Text accessibilityRole="alert" style={styles.error}>
        {errorText(list.error)}
      </Text>
    );
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <Alert item={item} unread={wasUnread?.has(item.id) ?? false} />}
      ListEmptyComponent={<Text style={styles.empty}>{t('empty')}</Text>}
    />
  );
}

function Alert({ item, unread }: { item: AppNotification; unread: boolean }) {
  const t = useTranslations('Alerts');
  const headline = useHeadline();
  const more = item.count - item.jobs.length;
  return (
    <View style={[styles.card, unread && styles.unread]}>
      <View style={styles.headLine}>
        {unread && <View accessibilityLabel={t('unread')} style={styles.dot} />}
        <Text style={styles.headline}>{headline(item)}</Text>
      </View>
      {item.jobs.map((job) => (
        <Pressable
          key={job.id}
          accessibilityRole="button"
          onPress={() => {
            router.push(`/job/${job.id}`);
          }}
          style={({ pressed }) => [styles.job, pressed && styles.pressed]}
        >
          <View style={styles.jobText}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={styles.company} numberOfLines={1}>
              {job.company}
            </Text>
          </View>
          {item.kind !== 'INTERVIEW_SOON' && <FitPill score={job.fit} />}
        </Pressable>
      ))}
      {item.kind === 'INTERVIEW_SOON' && <Text style={styles.hint}>{t('interviewHint')}</Text>}
      {item.kind !== 'INTERVIEW_SOON' && more > 0 && (
        <Text style={styles.hint}>{t('more', { count: more })}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  error: { margin: 16, color: colors.redText },
  empty: { margin: 16, color: colors.muted, textAlign: 'center' },
  card: {
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  unread: { backgroundColor: colors.orangeBg },
  headLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  headline: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  job: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.page,
  },
  pressed: { backgroundColor: colors.line },
  jobText: { flex: 1 },
  jobTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  company: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 13, color: colors.muted },
});
