import type { Job } from '@jobsearch/data';
import { useJobInsights, useMe, useMyProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAiChat } from '../../../lib/ai-chat';
import { AiTag } from '../components/AiLabels';
import { CopyButton } from '../components/CopyButton';
import { CopyText } from '../components/CopyText';
import type { DraftId } from './drafts';
import { CONNECT_LIMIT, messagesPrompt, recruiterDrafts } from './drafts';

const DRAFTS: DraftId[] = ['connect', 'recruiter', 'thanks'];

/**
 * The Messages tab: drafts to copy for a LinkedIn connection note, a message to the recruiter
 * and a thank-you after the interview, filled from your profile and the job (no AI). Like the
 * resume, they are in German only when the job needs German. A prompt asks your AI chat for
 * made-to-measure versions.
 */
function Drafts({ job }: { job: Job }) {
  const t = useTranslations('Jobs.messages');
  const chat = useAiChat();
  const { data: me } = useMe();
  const profile = useMyProfile();
  const insights = useJobInsights(job.id);
  const [recipient, setRecipient] = useState('');

  if (profile.isPending || insights.isPending) {
    return <p className="text-sm text-slate-500">{t('loading')}</p>;
  }

  const p = profile.data;
  const language = insights.data?.resumeLanguage === 'de' ? 'de' : 'en';
  const skills = (insights.data?.skills ?? [])
    .filter((s) => s.inResume || s.youHave)
    .map((s) => s.term);
  const achievements = (p?.achievements ?? '')
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  const fullName = [p?.firstName, p?.lastName].filter(Boolean).join(' ') || (me?.name ?? '');
  const input = {
    language,
    firstName: p?.firstName || fullName.split(' ')[0] || '',
    fullName,
    headline: p?.headline ?? '',
    yearsExperience: p?.yearsExperience ?? null,
    skills,
    achievement: achievements[0] ?? '',
    title: job.title,
    company: job.company.name,
    recipient,
  };
  const drafts = recruiterDrafts(input);

  return (
    <div className="space-y-6">
      <section aria-labelledby="messages-drafts" className="space-y-3">
        <h3 id="messages-drafts" className="text-sm font-semibold text-slate-900">
          {t('title')}
        </h3>
        <label className="block space-y-1 text-sm text-slate-700">
          <span className="block">{t('recipientLabel')}</span>
          <input
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
            }}
            placeholder={t('recipientPlaceholder')}
            className="h-9 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
          />
        </label>
        <p className="text-xs text-slate-500">
          {t(language === 'de' ? 'inGerman' : 'inEnglish')} {!p?.headline && t('addHeadline')}
        </p>
        <ul className="space-y-3">
          {DRAFTS.map((id) => (
            <li key={id} className="space-y-1.5 rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-slate-900">{t(`drafts.${id}`)}</h4>
                <span className="flex items-center gap-3">
                  {id === 'connect' && (
                    <span
                      className={`text-xs tabular-nums ${drafts.connect.length > CONNECT_LIMIT ? 'font-medium text-red-700' : 'text-slate-500'}`}
                    >
                      {t('chars', { count: drafts.connect.length, limit: CONNECT_LIMIT })}
                    </span>
                  )}
                  <CopyButton text={drafts[id]} />
                </span>
              </div>
              <p className="text-xs text-slate-500">{t(`when.${id}`)}</p>
              <p lang={language} className="text-sm whitespace-pre-line text-slate-700">
                {drafts[id]}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">{t('followUpHint')}</p>
      </section>

      <section aria-labelledby="messages-ai" className="space-y-2">
        <h3 id="messages-ai" className="text-sm font-semibold text-slate-900">
          {t('aiTitle')}
        </h3>
        <CopyText
          label={t('aiCopy')}
          text={messagesPrompt({ ...input, achievements })}
          copiedHint={t('aiCopied')}
          boxLabel={t('aiBox')}
          openUrl={chat.url}
          icon={<AiTag kind="chat" />}
        >
          <span className="text-sm text-slate-600">{t('aiHint')}</span>
        </CopyText>
      </section>
    </div>
  );
}

/** Loads your profile only once you open the tab; then keeps what you typed while you look around. */
export function MessagesPanel({ job, active }: { job: Job; active: boolean }) {
  const [opened, setOpened] = useState(active);
  if (active && !opened) setOpened(true);
  return opened ? <Drafts job={job} /> : null;
}
