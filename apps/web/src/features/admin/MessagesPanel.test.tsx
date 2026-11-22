import type { AdminConversation, ChatMessage } from '@jobsearch/data';
import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { Intl } from '@/test/intl';
import { ADMIN, api, server, session } from '@/test/server';
import { AdminPage } from './AdminPage';

let conversations: AdminConversation[] = [];
let thread: ChatMessage[] = [];
const replies: unknown[] = [];

const SARA: AdminConversation = {
  userId: 2,
  name: 'Sara Klein',
  email: 'sara@mail.de',
  lastBody: 'The PDF preview is blank',
  lastFromAdmin: false,
  lastAt: '2026-11-22T09:00:00.000Z',
  unread: 2,
};
const TOM: AdminConversation = {
  userId: 3,
  name: 'Tom Becker',
  email: 'tom@posteo.de',
  lastBody: 'Thanks, fixed now.',
  lastFromAdmin: true,
  lastAt: '2026-11-21T09:00:00.000Z',
  unread: 0,
};

beforeEach(() => {
  session.user = ADMIN;
  conversations = [SARA, TOM];
  thread = [
    {
      id: 1,
      fromAdmin: false,
      authorName: '',
      topic: 'BROKEN',
      body: 'The PDF preview is blank',
      createdAt: '2026-11-22T09:00:00.000Z',
    },
  ];
  replies.length = 0;
  server.use(
    api.query('AdminOverview', () =>
      HttpResponse.json({ errors: [{ message: 'not in this test' }] }),
    ),
    api.query('AdminConversations', () =>
      HttpResponse.json({ data: { adminConversations: conversations } }),
    ),
    api.query('AdminConversation', ({ variables }) => {
      conversations = conversations.map((c) =>
        c.userId === variables['userId'] ? { ...c, unread: 0 } : c,
      );
      return HttpResponse.json({ data: { adminConversation: thread } });
    }),
    api.mutation('ReplyMessage', ({ variables }) => {
      const input = variables['input'] as { userId: number; body: string };
      replies.push(input);
      const reply: ChatMessage = {
        id: 2,
        fromAdmin: true,
        authorName: 'Mohamed',
        topic: null,
        body: input.body,
        createdAt: '2026-11-22T10:00:00.000Z',
      };
      thread = [...thread, reply];
      return HttpResponse.json({ data: { replyMessage: reply } });
    }),
  );
});

function renderPage(locale: 'en' | 'de' = 'en') {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <Intl locale={locale}>
      <DataProvider store={makeStore()} queryClient={queryClient}>
        <AdminPage />
      </DataProvider>
    </Intl>,
  );
}

describe('Admin › Messages', () => {
  it('lists conversations, opens one, and sends an answer', async () => {
    const user = userEvent.setup();
    renderPage();
    const tab = await screen.findByRole('tab', { name: 'Messages, 2 waiting' });
    await user.click(tab);

    const list = await screen.findByRole('list', { name: 'Conversations' });
    const rows = within(list).getAllByRole('button');
    expect(rows[0]).toHaveTextContent(/Sara Klein.*2 new.*sara@mail\.de.*The PDF preview is blank/);
    expect(rows[1]).toHaveTextContent(/Tom Becker.*You: Thanks, fixed now\./);
    expect(screen.getByText('Pick a conversation to read and answer it.')).toBeInTheDocument();

    await user.click(rows[0]!);
    const conversation = await screen.findByRole('list', { name: 'Conversation with Sara Klein' });
    expect(within(conversation).getByText(/Something is broken ·/)).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Messages' })).toBeInTheDocument();

    const box = screen.getByRole('textbox', { name: 'Your answer to Sara Klein' });
    await user.type(box, 'Thanks! Fixed in the next update.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(
      await within(conversation).findByText('Thanks! Fixed in the next update.'),
    ).toBeInTheDocument();
    expect(replies).toEqual([{ userId: 2, body: 'Thanks! Fixed in the next update.' }]);
    expect(box).toHaveValue('');
    expect(screen.getByText(/They get a note in their bell/)).toBeInTheDocument();

    // On a phone, Back goes to the list again.
    await user.click(screen.getByRole('button', { name: /All messages/ }));
    expect(screen.getByText('Pick a conversation to read and answer it.')).toBeInTheDocument();
  });

  it('says so when nobody wrote yet, in German', async () => {
    conversations = [];
    const user = userEvent.setup();
    renderPage('de');
    await user.click(await screen.findByRole('tab', { name: 'Nachrichten' }));
    expect(await screen.findByText(/Noch keine Nachrichten\./)).toBeInTheDocument();
  });
});
