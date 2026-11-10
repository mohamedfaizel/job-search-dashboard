'use client';

import type { AdminUser } from '@jobsearch/data';
import { useDeleteUser } from '@jobsearch/data';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { useErrorText } from '@/i18n/useErrorText';

/**
 * Deleting an account can't be undone, so it asks for the account's email first. The button
 * stays off until the email matches. Esc or Cancel closes it.
 */
export function DeleteUserDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const t = useTranslations('Admin.delete');
  const errorText = useErrorText();
  const remove = useDeleteUser();
  const [typed, setTyped] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const textId = useId();
  const ok = typed.trim().toLowerCase() === user.email.toLowerCase();

  useEffect(() => {
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!ok) return;
          remove.mutate({ userId: user.id, confirmEmail: typed }, { onSuccess: onClose });
        }}
        className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {t('title', { name: user.name })}
        </h2>
        <p id={textId} className="text-sm text-slate-700">
          {t('text')}
        </p>
        <label className="block space-y-1 text-sm font-medium text-slate-800">
          <span>{t('confirm')}</span>
          <input
            ref={input}
            type="email"
            autoComplete="off"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            placeholder={user.email}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        {remove.isError && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(remove.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={!ok || remove.isPending}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {remove.isPending ? t('deleting') : t('go')}
          </button>
        </div>
      </form>
    </div>
  );
}
