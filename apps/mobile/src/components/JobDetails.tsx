import type { Job } from '@jobsearch/data';
import { useJob, useUpdateJobStatus } from '@jobsearch/data';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { colors } from '../lib/theme';
import { useErrorText } from '../lib/useErrorText';
import { FitPill, placeOf } from './JobRow';
import { StatusPicker } from './StatusPicker';

/** "$90,000 – $120,000", or one end when only one is known. */
function Salary({ job }: { job: Job }) {
  const t = useTranslations('Job');
  const format = useFormatter();
  const money = (usd: number) =>
    format.number(usd, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const { salaryMinUsd: min, salaryMaxUsd: max } = job;
  const one = min ?? max;
  if (one === null) return null;
  const salary =
    min !== null && max !== null && min !== max ? `${money(min)} – ${money(max)}` : money(one);
  return <Text style={styles.text}>{t('salary', { salary })}</Text>;
}

/**
 * One job, like the website's popup: title, company, Fit %, your tracker status (tap to move
 * it), the link to the ad and the ad's text.
 */
export function JobDetails({ id }: { id: string }) {
  const t = useTranslations('Job');
  const tJobs = useTranslations('Jobs');
  const format = useFormatter();
  const errorText = useErrorText();
  const job = useJob(id);
  const status = useUpdateJobStatus();

  if (job.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} accessibilityLabel={tJobs('loading')} />
      </View>
    );
  }
  if (job.isError) {
    return (
      <Text accessibilityRole="alert" style={[styles.error, styles.pad]}>
        {errorText(job.error)}
      </Text>
    );
  }
  const data = job.data;
  const place = placeOf(data, tJobs);
  const url = data.url;
  // The status shown moves at once; the server's answer follows.
  const current = status.isPending ? status.variables.status : data.applicationStatus;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {data.title}
        </Text>
        <Text style={styles.company}>{data.company.name}</Text>
        {place !== '' && <Text style={styles.muted}>{place}</Text>}
        <View style={styles.facts}>
          <FitPill score={data.fitScore} />
          <Text style={styles.muted}>
            {t('posted', {
              date: format.dateTime(new Date(data.postedAt), { dateStyle: 'medium' }),
            })}
          </Text>
        </View>
        <Salary job={data} />
        {data.skills.length > 0 && (
          <Text style={styles.muted}>{t('skills', { skills: data.skills.join(', ') })}</Text>
        )}
        {url && (
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL(url);
            }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{t('openAd')} ↗</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{t('status')}</Text>
        <StatusPicker
          value={current}
          busy={status.isPending}
          onChange={(next) => {
            status.mutate({ id: data.id, status: next });
          }}
        />
        {status.isError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorText(status.error)}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{t('ad')}</Text>
        <Text selectable style={styles.text}>
          {data.description ?? t('noAd')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  pad: { padding: 16 },
  page: { padding: 12, gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 6 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  company: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  facts: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  text: { fontSize: 15, lineHeight: 22, color: colors.text },
  error: { fontSize: 14, color: colors.redText, marginTop: 6 },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: colors.black, fontSize: 15, fontWeight: '700' },
});
