import { useJobsPage, useJobsVisit } from '@jobsearch/data';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { colors } from '../lib/theme';
import { useErrorText } from '../lib/useErrorText';
import { JobRow } from './JobRow';

/** How many jobs one scroll to the end adds. */
export const PAGE_SIZE = 30;

/**
 * Your jobs, newest first, with their Fit %. Pull down to refresh; scrolling to the end shows
 * more. Jobs added since your last visit (here or on the website) are New.
 */
export function JobList() {
  const t = useTranslations('Jobs');
  const errorText = useErrorText();
  const [size, setSize] = useState(PAGE_SIZE);
  const visit = useJobsVisit();
  const jobs = useJobsPage({
    page: 1,
    pageSize: size,
    sort: { field: 'POSTED_AT', direction: 'DESC' },
  });
  const since = visit.data ?? null;
  const items = jobs.data?.items ?? [];
  const total = jobs.data?.total ?? 0;

  if (jobs.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} accessibilityLabel={t('loading')} />
      </View>
    );
  }
  return (
    <FlatList
      testID="job-list"
      data={items}
      keyExtractor={(job) => job.id}
      renderItem={({ item }) => (
        <JobRow job={item} isNew={since !== null && item.createdAt > since} />
      )}
      refreshControl={
        <RefreshControl
          refreshing={jobs.isRefetching}
          onRefresh={() => {
            void jobs.refetch();
          }}
        />
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (items.length < total && !jobs.isFetching) setSize((s) => s + PAGE_SIZE);
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.count}>{t('count', { count: total })}</Text>
          {jobs.isError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {errorText(jobs.error)}
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={jobs.isError ? undefined : <Text style={styles.empty}>{t('empty')}</Text>}
      ListFooterComponent={
        items.length < total ? (
          <ActivityIndicator style={styles.more} color={colors.black} />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  count: { fontSize: 13, color: colors.muted },
  error: { fontSize: 14, color: colors.redText },
  empty: { padding: 24, textAlign: 'center', color: colors.muted, fontSize: 15 },
  more: { padding: 16 },
});
