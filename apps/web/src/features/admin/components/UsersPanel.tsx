'use client';

import type { AdminUser } from '@jobsearch/data';
import { useAdminUsers, useSetUserDisabled, useSetUserRole } from '@jobsearch/data';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useErrorText } from '@/i18n/useErrorText';
import { DeleteUserDialog } from './DeleteUserDialog';

type Filter = 'all' | 'admins' | 'disabled' | 'noKey';
const FILTERS: Filter[] = ['all', 'admins', 'disabled', 'noKey'];

const BUTTON =
  'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50';

function matches(user: AdminUser, filter: Filter, query: string): boolean {
  if (filter === 'admins' && user.role !== 'ADMIN') return false;
  if (filter === 'disabled' && !user.disabled) return false;
  if (filter === 'noKey' && user.hasJobKey) return false;
  const q = query.trim().toLowerCase();
  return !q || user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
}

/**
 * Admin › Users: every account with its role, when it joined and was last seen, whether it has
 * a job data key, and its imports this month. Make or remove admin, switch off or on, delete.
 * Wide screens get a table, phones one card per account.
 */
export function UsersPanel({ meId }: { meId: number }) {
  const t = useTranslations('Admin.users');
  const errorText = useErrorText();
  const users = useAdminUsers();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const setRole = useSetUserRole();
  const setDisabled = useSetUserDisabled();
  const error = setRole.error ?? setDisabled.error;

  const shown = useMemo(
    () => (users.data ?? []).filter((user) => matches(user, filter, query)),
    [users.data, filter, query],
  );

  if (users.isPending) return <p className="text-sm text-slate-600">{t('loading')}</p>;
  if (users.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(users.error)}
      </p>
    );
  }

  const actions: RowActions = {
    meId,
    busy: setRole.isPending || setDisabled.isPending,
    onRole: (user) => {
      setRole.mutate({ userId: user.id, role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' });
    },
    onDisabled: (user) => {
      setDisabled.mutate({ userId: user.id, disabled: !user.disabled });
    },
    onDelete: setDeleting,
  };

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">
        {t('heading', { count: users.data.length })}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {/* Its own full-width row on a phone; next to the filters on a wider screen. */}
        <label className="flex w-full min-w-0 sm:w-auto sm:max-w-sm sm:flex-1">
          <span className="sr-only">{t('search')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={t('searchPlaceholder')}
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-base sm:h-auto sm:py-2 sm:text-sm"
          />
        </label>
        <div role="group" aria-label={t('filters')} className="flex flex-wrap gap-1.5">
          {FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id);
              }}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white"
            >
              {t(`filter.${id}`)}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(error)}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          {t('empty')}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-2.5">
                    {t('name')}
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    {t('role')}
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    {t('joined')}
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    {t('lastSeen')}
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    {t('key')}
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    {t('imports')}
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">{t('actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((user) => (
                  <UserRow key={user.id} user={user} actions={actions} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {shown.map((user) => (
              <UserCard key={user.id} user={user} actions={actions} />
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-slate-600">{t('note')}</p>
      {deleting && (
        <DeleteUserDialog
          user={deleting}
          onClose={() => {
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

interface RowActions {
  meId: number;
  busy: boolean;
  onRole: (user: AdminUser) => void;
  onDisabled: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}

function RoleChip({ user }: { user: AdminUser }) {
  const t = useTranslations('Admin.users');
  if (user.disabled) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
        {t('disabled')}
      </span>
    );
  }
  return user.role === 'ADMIN' ? (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
      {t('roleAdmin')}
    </span>
  ) : (
    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-900">
      {t('roleUser')}
    </span>
  );
}

function KeyMark({ has }: { has: boolean }) {
  const t = useTranslations('Admin.users');
  return (
    <span
      role="img"
      aria-label={t(has ? 'hasKey' : 'noKey')}
      title={t(has ? 'hasKey' : 'noKey')}
      className={`font-bold ${has ? 'text-emerald-700' : 'text-red-700'}`}
    >
      {has ? '✓' : '✗'}
    </span>
  );
}

function useWhen() {
  const t = useTranslations('Admin.users');
  const format = useFormatter();
  return {
    joined: (iso: string) =>
      format.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' }),
    seen: (iso: string | null) =>
      iso ? format.relativeTime(new Date(iso), new Date()) : t('never'),
  };
}

/** The buttons for one account; none on your own (you change yourself in Settings). */
function Actions({ user, actions, wide }: { user: AdminUser; actions: RowActions; wide: boolean }) {
  const t = useTranslations('Admin.users');
  const [open, setOpen] = useState(false);
  if (user.id === actions.meId) {
    return <span className="text-xs text-slate-600">{t('you')}</span>;
  }
  const main = user.disabled ? (
    <button
      type="button"
      disabled={actions.busy}
      onClick={() => {
        actions.onDisabled(user);
      }}
      className={BUTTON}
    >
      {t('enable')}
    </button>
  ) : (
    <button
      type="button"
      disabled={actions.busy}
      onClick={() => {
        actions.onRole(user);
      }}
      className={BUTTON}
    >
      {t(user.role === 'ADMIN' ? 'removeAdmin' : 'makeAdmin')}
    </button>
  );
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${wide ? 'justify-end' : ''}`}>
      {main}
      <button
        type="button"
        aria-label={t('more', { name: user.name })}
        aria-expanded={open}
        onClick={() => {
          setOpen((was) => !was);
        }}
        className={`${BUTTON} ${wide ? '' : 'h-11 w-11'} px-2`}
      >
        ⋯
      </button>
      {open && (
        <span className="flex basis-full flex-wrap gap-1.5 sm:basis-auto">
          {!user.disabled && (
            <button
              type="button"
              disabled={actions.busy}
              onClick={() => {
                actions.onDisabled(user);
              }}
              className={BUTTON}
            >
              {t('disable')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              actions.onDelete(user);
            }}
            className={`${BUTTON} border-red-300 text-red-700 hover:bg-red-50`}
          >
            {t('delete')}
          </button>
        </span>
      )}
    </div>
  );
}

function UserRow({ user, actions }: { user: AdminUser; actions: RowActions }) {
  const when = useWhen();
  return (
    <tr className={`border-t border-slate-100 ${user.disabled ? 'text-slate-600' : ''}`}>
      <td className="px-4 py-2.5">
        <span className="block font-semibold text-slate-900">{user.name}</span>
        <span className="block text-xs text-slate-600">{user.email}</span>
      </td>
      <td className="px-3 py-2.5">
        <RoleChip user={user} />
      </td>
      <td className="px-3 py-2.5 text-slate-700">{when.joined(user.joinedAt)}</td>
      <td className="px-3 py-2.5 text-slate-700">{when.seen(user.lastSeenAt)}</td>
      <td className="px-3 py-2.5">
        <KeyMark has={user.hasJobKey} />
      </td>
      <td className="px-3 py-2.5 text-slate-700 tabular-nums">{user.importsThisMonth}</td>
      <td className="px-4 py-2.5">
        <Actions user={user} actions={actions} wide />
      </td>
    </tr>
  );
}

function UserCard({ user, actions }: { user: AdminUser; actions: RowActions }) {
  const t = useTranslations('Admin.users');
  const when = useWhen();
  return (
    <li className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
          {user.name}
        </span>
        <RoleChip user={user} />
      </div>
      <p className="truncate text-xs text-slate-600">{user.email}</p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-700">
        <KeyMark has={user.hasJobKey} />
        <span>· {t('seenShort', { when: when.seen(user.lastSeenAt) })}</span>
        <span>· {t('importsShort', { count: user.importsThisMonth })}</span>
      </p>
      <Actions user={user} actions={actions} wide={false} />
    </li>
  );
}
