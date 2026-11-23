'use client';

import type { ChatMessage, MessageTopic } from '@jobsearch/data';
import { useMarkMyMessagesRead, useMyMessages, useSendMessage } from '@jobsearch/data';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useErrorText } from '@/i18n/useErrorText';
import { MAKER } from '@/lib/maker';
import { closeMessageWindow, useMessageWindowOpen } from '@/lib/message-window';

export const TOPICS: readonly MessageTopic[] = ['QUESTION', 'SUGGESTION', 'BROKEN'];
const MAX_BODY = 2000;

/** "22 Nov, 21:40", in the app's language. */
export function sentAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/**
 * One line of a conversation: your own on the right in black, the other side's on the left in
 * white. `adminView` is true on Admin › Messages, where the admins' answers are "your own".
 */
export function Bubble({ message, adminView }: { message: ChatMessage; adminView: boolean }) {
  const t = useTranslations('Messages');
  const locale = useLocale();
  const right = message.fromAdmin === adminView;
  return (
    <li className={`flex flex-col gap-1 ${right ? 'items-end' : 'items-start'}`}>
      <p
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
          right
            ? 'rounded-br-sm bg-black text-white'
            : 'rounded-bl-sm border border-slate-200 bg-white text-slate-900'
        }`}
      >
        {message.body}
      </p>
      <p className="text-xs text-slate-600">
        {message.fromAdmin
          ? t('answeredBy', { name: message.authorName || MAKER.name })
          : message.topic
            ? t(`topics.${message.topic}`)
            : null}{' '}
        · {sentAt(message.createdAt, locale)}
      </p>
    </li>
  );
}

/**
 * The "Message Mohamed Faizel" window: the photo, a hello, your conversation, a topic and a
 * box to write in. A card at the bottom right on a computer, full screen on a phone.
 */
export function MessageWindow() {
  const open = useMessageWindowOpen();
  return open ? <Window /> : null;
}

function Window() {
  const t = useTranslations('Messages');
  const titleId = useId();

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMessageWindow();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] flex flex-col bg-white text-slate-900 sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[36rem] sm:max-h-[calc(100vh-3rem)] sm:w-[24rem] sm:overflow-hidden sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl"
    >
      <MakerHeader titleId={titleId} title={t('title', { name: MAKER.name })}>
        <button
          type="button"
          onClick={closeMessageWindow}
          aria-label={t('close')}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          ×
        </button>
      </MakerHeader>
      <Conversation focusBox />
    </div>
  );
}

/** The black bar on top: the round photo, a title and a short line under it. */
export function MakerHeader({
  titleId,
  title,
  sub,
  page = false,
  children,
}: {
  titleId: string;
  title: string;
  /** The small line under the title; "Queries and suggestions welcome" when left out. */
  sub?: string;
  /** On its own page the title is the page's h1. */
  page?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('Messages');
  const Heading = page ? 'h1' : 'h2';
  return (
    <header className="flex items-center gap-3 border-b-[3px] border-brand-400 bg-black px-4 py-3 text-white">
      <img
        src={MAKER.face}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-full border-2 border-brand-400"
      />
      <div className="min-w-0">
        <Heading id={titleId} className="truncate font-bold">
          {title}
        </Heading>
        <p className="text-xs text-neutral-300">{sub ?? t('sub')}</p>
      </div>
      {children}
    </header>
  );
}

/**
 * Your conversation with the maker and the box to write in. The message window and the
 * Queries and suggestions page both show it.
 */
export function Conversation({ focusBox = false }: { focusBox?: boolean }) {
  const t = useTranslations('Messages');
  const errorText = useErrorText();
  const id = useId();
  const { data, isPending } = useMyMessages();
  const send = useSendMessage();
  const markRead = useMarkMyMessagesRead();
  const [topic, setTopic] = useState<MessageTopic>('QUESTION');
  const [body, setBody] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const unread = data?.unread ?? 0;

  useEffect(() => {
    if (focusBox) box.current?.focus();
  }, [focusBox]);

  // Answers you can see now are read.
  const { mutate: markMine } = markRead;
  useEffect(() => {
    if (unread > 0) markMine();
  }, [unread, markMine]);

  // Keep the newest line in view.
  const count = data?.items.length ?? 0;
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [count]);

  const text = body.trim();

  return (
    <>
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-slate-100 p-4">
        <p className="rounded-xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-sm">
          {t('hello')}
        </p>
        {isPending ? (
          <p className="text-sm text-slate-600">{t('loading')}</p>
        ) : (
          <ol aria-label={t('conversation')} className="space-y-3">
            {data?.items.map((message) => (
              <Bubble key={message.id} message={message} adminView={false} />
            ))}
          </ol>
        )}
      </div>
      <form
        className="space-y-2 border-t border-slate-200 bg-white p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text || send.isPending) return;
          send.mutate(
            { topic, body: text },
            {
              onSuccess: () => {
                setBody('');
              },
            },
          );
        }}
      >
        <fieldset>
          <legend className="sr-only">{t('topic')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map((value) => (
              <label
                key={value}
                className="cursor-pointer rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold has-checked:border-brand-400 has-checked:bg-brand-400 has-focus-visible:outline-2 has-focus-visible:outline-black"
              >
                <input
                  type="radio"
                  name={`${id}-topic`}
                  value={value}
                  checked={topic === value}
                  onChange={() => {
                    setTopic(value);
                  }}
                  className="sr-only"
                />
                {t(`topics.${value}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor={`${id}-body`}>
            {t('label')}
          </label>
          <textarea
            id={`${id}-body`}
            ref={box}
            rows={2}
            maxLength={MAX_BODY}
            value={body}
            placeholder={t('placeholder')}
            onChange={(event) => {
              setBody(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="min-h-10 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text || send.isPending}
            className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-black hover:bg-brand-300 disabled:opacity-50"
          >
            {send.isPending ? t('sending') : t('send')}
          </button>
        </div>
        {send.isError && (
          <p role="alert" className="text-xs text-red-700">
            {errorText(send.error)}
          </p>
        )}
      </form>
    </>
  );
}
