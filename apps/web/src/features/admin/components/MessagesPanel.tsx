'use client';

import type { AdminConversation } from '@jobsearch/data';
import { useAdminConversation, useAdminConversations, useReplyMessage } from '@jobsearch/data';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Bubble, sentAt } from '@/features/messages/MessageWindow';
import { useErrorText } from '@/i18n/useErrorText';

const MAX_BODY = 2000;

function Row({
  item,
  selected,
  onPick,
}: {
  item: AdminConversation;
  selected: boolean;
  onPick: () => void;
}) {
  const t = useTranslations('Admin.messages');
  const locale = useLocale();
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={onPick}
        className="w-full space-y-0.5 px-3 py-2.5 text-left hover:bg-slate-50 aria-[current=true]:bg-brand-50"
      >
        <span className="flex items-baseline gap-2">
          <b className="min-w-0 truncate text-sm font-semibold text-slate-900">{item.name}</b>
          {item.unread > 0 && (
            <span className="rounded-full bg-red-600 px-1.5 text-[11px] leading-4 font-semibold text-white">
              {t('new', { count: item.unread })}
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs text-slate-600">
            {sentAt(item.lastAt, locale)}
          </span>
        </span>
        <span className="block truncate text-xs text-slate-600">{item.email}</span>
        <span className="block truncate text-sm text-slate-700">
          {item.lastFromAdmin ? `${t('you')}: ` : ''}
          {item.lastBody}
        </span>
      </button>
    </li>
  );
}

function Thread({ item, onBack }: { item: AdminConversation; onBack: () => void }) {
  const t = useTranslations('Admin.messages');
  const errorText = useErrorText();
  const thread = useAdminConversation(item.userId);
  const reply = useReplyMessage();
  const [body, setBody] = useState('');
  const text = body.trim();

  return (
    <div className="flex min-h-[24rem] flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 md:hidden"
        >
          ‹ {t('back')}
        </button>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{item.name}</p>
          <p className="truncate text-xs text-slate-600">{item.email}</p>
        </div>
      </div>
      <div className="max-h-[28rem] flex-1 overflow-y-auto bg-slate-100 p-3">
        {thread.isPending ? (
          <p className="text-sm text-slate-600">{t('loading')}</p>
        ) : thread.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {errorText(thread.error)}
          </p>
        ) : (
          <ol aria-label={t('conversation', { name: item.name })} className="space-y-3">
            {thread.data.map((message) => (
              <Bubble key={message.id} message={message} adminView />
            ))}
          </ol>
        )}
      </div>
      <form
        className="space-y-1 border-t border-slate-200 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text || reply.isPending) return;
          reply.mutate(
            { userId: item.userId, body: text },
            {
              onSuccess: () => {
                setBody('');
              },
            },
          );
        }}
      >
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="admin-reply">
            {t('replyLabel', { name: item.name })}
          </label>
          <textarea
            id="admin-reply"
            rows={2}
            maxLength={MAX_BODY}
            value={body}
            placeholder={t('replyPlaceholder')}
            onChange={(event) => {
              setBody(event.target.value);
            }}
            className="min-h-10 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text || reply.isPending}
            className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-black hover:bg-brand-300 disabled:opacity-50"
          >
            {reply.isPending ? t('sending') : t('send')}
          </button>
        </div>
        <p className="text-xs text-slate-600">{t('bellNote')}</p>
        {reply.isError && (
          <p role="alert" className="text-xs text-red-700">
            {errorText(reply.error)}
          </p>
        )}
      </form>
    </div>
  );
}

/**
 * Admin › Messages: every user's messages to the makers, unanswered first. Every admin sees the
 * same list; answering rings the user's bell.
 */
export function MessagesPanel() {
  const t = useTranslations('Admin.messages');
  const errorText = useErrorText();
  const list = useAdminConversations();
  const [picked, setPicked] = useState<number | null>(null);

  if (list.isPending) return <p className="text-sm text-slate-600">{t('loading')}</p>;
  if (list.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorText(list.error)}
      </p>
    );
  }
  if (list.data.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        {t('empty')}
      </p>
    );
  }
  const current = list.data.find((item) => item.userId === picked) ?? null;

  return (
    <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-[18rem_1fr]">
      <ul
        aria-label={t('list')}
        className={`divide-y divide-slate-100 border-slate-200 md:border-r ${current ? 'hidden md:block' : ''}`}
      >
        {list.data.map((item) => (
          <Row
            key={item.userId}
            item={item}
            selected={item.userId === picked}
            onPick={() => {
              setPicked(item.userId);
            }}
          />
        ))}
      </ul>
      {current ? (
        <Thread
          key={current.userId}
          item={current}
          onBack={() => {
            setPicked(null);
          }}
        />
      ) : (
        <p className="hidden p-6 text-sm text-slate-600 md:block">{t('pick')}</p>
      )}
    </div>
  );
}
