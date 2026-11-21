import type { MatcherResume, ResumeMatcherStatus } from '@jobsearch/data';
import { useTranslations } from 'next-intl';

/**
 * Resume-Matcher's state in the user's language. The server's `message` is English, so the
 * sentence is built here from the status fields; any raw error stays as a detail under it.
 */
export function useMatcherText() {
  const t = useTranslations('Settings.matcher.text');

  /** The sentence for a status, with or without the AI test. Setup hints are for admins. */
  function status(data: ResumeMatcherStatus, isAdmin: boolean): string {
    if (!data.configured) return isAdmin ? t('status.off') : t('status.unavailable');
    if (!data.reachable) return isAdmin ? t('status.down') : t('status.unavailable');
    // aiHealthy is null when the AI test wasn't asked for, or when it broke (then error is set).
    if (data.aiHealthy === null) return data.error ? t('status.aiError') : t('status.running');
    if (!data.aiProvider) return t('status.noKey');
    if (data.aiHealthy) return t('status.aiOk', { provider: data.aiProvider });
    return t('status.aiFailed', { provider: data.aiProvider, model: data.aiModel ?? '?' });
  }

  function resume(data: MatcherResume): string {
    return t(`resume.${data.state}`, { file: data.fileName ?? '' });
  }

  function detail(error: string | null | undefined): string | null {
    return error ? t('detail', { error }) : null;
  }

  return { status, resume, detail };
}
