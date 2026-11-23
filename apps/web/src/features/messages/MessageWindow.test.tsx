import type { ChatMessage } from '@jobsearch/data';
import { createQueryClient, DataProvider, makeStore } from '@jobsearch/data';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { MakerLine } from '@/components/MakerLine';
import type { Locale } from '@/i18n/config';
import { closeMessageWindow, openMessageWindow } from '@/lib/message-window';
import { Intl } from '@/test/intl';
import { api, server } from '@/test/server';
import { LOGIN_TO_MESSAGE, MessageOpener, MessageWindowHost } from './MessageOpener';
import { MessagesPage } from './MessagesPage';

let items: ChatMessage[] = [];
let unread = 0;
let markedRead = 0;
const sent: unknown[] = [];

const ANSWER: ChatMessage = {
  id: 2,
  fromAdmin: true,
  authorName: 'Mohamed Faizel',
  topic: null,
  body: 'Good idea, it is on my list.',
  createdAt: '2026-11-20T10:00:00.000Z',
};
const MINE: ChatMessage = {
  id: 1,
  fromAdmin: false,
  authorName: '',
  topic: 'SUGGESTION',
  body: 'Could the Tracker show the date I applied?',
  createdAt: '2026-11-20T09:00:00.000Z',
};

beforeEach(() => {
  items = [];
  unread = 0;
  markedRead = 0;
  sent.length = 0;
  server.use(
    api.query('MyMessages', () => HttpResponse.json({ data: { myMessages: { items, unread } } })),
    api.mutation('SendMessage', ({ variables }) => {
      const input = variables['input'] as { topic: ChatMessage['topic']; body: string };
      sent.push(input);
      if (input.body === 'flood') {
        return HttpResponse.json({
          errors: [
            {
              message: 'Too many',
              extensions: { apiCode: 'MESSAGE_LIMIT', apiParams: { max: 10 } },
            },
          ],
        });
      }
      const message: ChatMessage = {
        id: items.length + 1,
        fromAdmin: false,
        authorName: '',
        topic: input.topic,
        body: input.body,
        createdAt: new Date().toISOString(),
      };
      items = [...items, message];
      return HttpResponse.json({ data: { sendMessage: message } });
    }),
    api.mutation('MarkMyMessagesRead', () => {
      markedRead += 1;
      const count = unread;
      unread = 0;
      return HttpResponse.json({ data: { markMyMessagesRead: count } });
    }),
    api.query('Notifications', () =>
      HttpResponse.json({ data: { notifications: { items: [], unread: 0 } } }),
    ),
  );
});
afterEach(() => {
  act(() => {
    closeMessageWindow();
  });
});

function renderWindow(locale: Locale = 'en') {
  render(
    <Intl locale={locale}>
      <DataProvider store={makeStore()} queryClient={createQueryClient()}>
        <MakerLine loggedIn />
        <MessageWindowHost />
      </DataProvider>
    </Intl>,
  );
}

describe('MessageWindow', () => {
  it('opens from the footer line, shows the conversation and marks answers read', async () => {
    items = [MINE, ANSWER];
    unread = 1;
    const user = userEvent.setup();
    renderWindow();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Queries and suggestions welcome/ }));
    const dialog = screen.getByRole('dialog', { name: 'Message Mohamed Faizel' });
    expect(within(dialog).getByText(/I built Job Search Hunter/)).toBeInTheDocument();
    const list = await within(dialog).findByRole('list', { name: 'Your messages' });
    expect(within(list).getByText(MINE.body)).toBeInTheDocument();
    expect(within(list).getByText(/Suggestion ·/)).toBeInTheDocument();
    expect(within(list).getByText(/Mohamed Faizel replied ·/)).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(markedRead).toBe(1);
    });
    // The text box has focus, and Escape closes the window.
    expect(within(dialog).getByRole('textbox', { name: 'Your message' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sends a message with the topic you picked', async () => {
    const user = userEvent.setup();
    renderWindow();
    act(() => {
      openMessageWindow();
    });
    const dialog = screen.getByRole('dialog');
    const send = within(dialog).getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();

    await user.click(within(dialog).getByRole('radio', { name: 'Something is broken' }));
    await user.type(within(dialog).getByRole('textbox'), '  The PDF preview is blank  ');
    await user.click(send);

    expect(await within(dialog).findByText('The PDF preview is blank')).toBeInTheDocument();
    expect(sent).toEqual([{ topic: 'BROKEN', body: 'The PDF preview is blank' }]);
    expect(within(dialog).getByRole('textbox')).toHaveValue('');
    expect(within(dialog).getByText(/Something is broken ·/)).toBeInTheDocument();
  });

  it('says why a message could not be sent, in German too', async () => {
    const user = userEvent.setup();
    renderWindow('de');
    act(() => {
      openMessageWindow();
    });
    const dialog = screen.getByRole('dialog', { name: 'Nachricht an Mohamed Faizel' });
    await user.type(within(dialog).getByRole('textbox'), 'flood');
    await user.click(within(dialog).getByRole('button', { name: 'Senden' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Du kannst 10 Nachrichten pro Stunde senden.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens by itself after logging in (?message=1), and sends visitors to log in first', async () => {
    window.history.replaceState(null, '', '/about?message=1#contact');
    renderWindow();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#contact');

    render(
      <Intl>
        <MessageOpener loggedIn={false}>Message</MessageOpener>
      </Intl>,
    );
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute('href', LOGIN_TO_MESSAGE);
    expect(LOGIN_TO_MESSAGE).toBe('/login?next=%2Fabout%3Fmessage%3D1');
  });
});

describe('MessagesPage', () => {
  function renderPage(locale: Locale = 'en') {
    render(
      <Intl locale={locale}>
        <DataProvider store={makeStore()} queryClient={createQueryClient()}>
          <MessagesPage />
        </DataProvider>
      </Intl>,
    );
  }

  it('shows the conversation on its own page and sends from there', async () => {
    items = [MINE, ANSWER];
    unread = 1;
    const user = userEvent.setup();
    renderPage();

    const page = screen.getByRole('region', { name: 'Queries and suggestions' });
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Queries and suggestions',
    );
    const list = await within(page).findByRole('list', { name: 'Your messages' });
    expect(within(list).getByText(ANSWER.body)).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(markedRead).toBe(1);
    });

    await user.click(within(page).getByRole('radio', { name: 'Suggestion' }));
    await user.type(within(page).getByRole('textbox', { name: 'Your message' }), 'Dark mode?');
    await user.click(within(page).getByRole('button', { name: 'Send' }));
    expect(await within(page).findByText('Dark mode?')).toBeInTheDocument();
    expect(sent).toEqual([{ topic: 'SUGGESTION', body: 'Dark mode?' }]);
  });

  it('is in German for a German account', () => {
    renderPage('de');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Fragen und Vorschläge' }),
    ).toBeInTheDocument();
  });
});
