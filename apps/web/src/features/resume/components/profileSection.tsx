import { zodResolver } from '@hookform/resolvers/zod';
import type { Profile } from '@jobsearch/data';
import { useMyProfile, useUpdateProfile } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AutoHide } from '../../../components/AutoHide';
import { useErrorText } from '../../../i18n/useErrorText';
import type { ProfileFormValues } from '../../profile/schema';
import { profileSchema, profileToForm, toProfileInput } from '../../profile/schema';

/** Waits for your saved profile, then shows `children` with it (or the error). */
export function WithProfile({ children }: { children: (profile: Profile) => ReactNode }) {
  const errorText = useErrorText();
  const t = useTranslations('Resume.files');
  const profile = useMyProfile();
  if (profile.isPending) return <p className="text-sm text-slate-600">{t('loading')}</p>;
  if (profile.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(profile.error)}
      </p>
    );
  }
  return <>{children(profile.data)}</>;
}

/**
 * A form over part of your profile. The rest of the profile goes along unchanged: the save sends
 * the whole saved profile.
 */
export function useProfileSection(profile: Profile) {
  const tError = useTranslations('Profile.errors');
  const schema = useMemo(
    () => profileSchema((key, values) => tError(key as 'date', values as never)),
    [tError],
  );
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: profileToForm(profile),
  });
  const { handleSubmit, reset } = form;
  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    const result = await update.mutateAsync(toProfileInput(values)).catch(() => null);
    if (result) {
      setSaved(true);
      reset(profileToForm(result));
    }
  });
  return { form, update, saved, setSaved, onSubmit };
}

/** The Save button with its "saved" and error messages. */
export function SaveBar({
  auto = false,
  label,
  savedText,
  busy,
  showSaved,
  submittedAt,
  error,
}: {
  /** The form saves by itself: no button, only "Saved" or the error. */
  auto?: boolean;
  label: string;
  savedText: string;
  busy: boolean;
  showSaved: boolean;
  submittedAt: number;
  error: string | null;
}) {
  const t = useTranslations('Profile');
  return (
    <div className="flex items-center gap-3">
      {auto ? (
        busy && <p className="text-sm text-slate-600">{t('saving')}</p>
      ) : (
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? t('saving') : label}
        </button>
      )}
      {showSaved && (
        <AutoHide key={submittedAt}>
          <p role="status" className="text-sm text-emerald-700">
            {savedText}
          </p>
        </AutoHide>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
