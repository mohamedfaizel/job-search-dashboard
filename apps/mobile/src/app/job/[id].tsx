import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslations } from 'use-intl';
import { JobDetails } from '../../components/JobDetails';

/** One job, opened from the list. */
export default function JobScreen() {
  const t = useTranslations('Job');
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <JobDetails id={id} />
    </>
  );
}
