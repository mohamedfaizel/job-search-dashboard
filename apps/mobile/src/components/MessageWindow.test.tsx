import type { ChatMessage } from '@jobsearch/data';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeApi, user } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { MessageWindow } from './MessageWindow';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const mine: ChatMessage = {
  id: 1,
  fromAdmin: false,
  authorName: '',
  topic: 'SUGGESTION',
  body: 'Could the Tracker show the date I applied?',
  createdAt: '2026-11-22T21:15:00.000Z',
};
const answer: ChatMessage = {
  id: 2,
  fromAdmin: true,
  authorName: 'Mohamed Faizel',
  topic: null,
  body: 'Good idea, thank you!',
  createdAt: '2026-11-22T21:20:00.000Z',
};

function api(items: ChatMessage[], unread = 0) {
  return fakeApi({
    Me: () => ({ data: { me: user } }),
    MyMessages: () => ({ data: { myMessages: { items, unread } } }),
    MarkMyMessagesRead: () => ({ data: { markMyMessagesRead: unread } }),
    Notifications: () => ({ data: { notifications: { items: [], unread: 0 } } }),
    SendMessage: ({ input }) => ({
      data: {
        sendMessage: {
          id: 3,
          fromAdmin: false,
          authorName: '',
          createdAt: '2026-11-23T08:00:00.000Z',
          ...(input as { topic: string; body: string }),
        },
      },
    }),
  });
}

describe('MessageWindow', () => {
  it('shows the hello, your messages and the answers, and marks answers read', async () => {
    const calls = api([mine, answer], 1);
    await renderApp(<MessageWindow />);
    expect(screen.getByRole('header')).toHaveTextContent('Message Mohamed Faizel');
    expect(screen.getByText('Queries and suggestions welcome')).toBeOnTheScreen();
    expect(screen.getByText(/^Hi! I built Job Search Hunter/)).toBeOnTheScreen();
    expect(await screen.findByText(mine.body)).toBeOnTheScreen();
    expect(screen.getByText(answer.body)).toBeOnTheScreen();
    expect(screen.getByText(/^Suggestion · /)).toBeOnTheScreen();
    expect(screen.getByText(/^Mohamed Faizel replied · /)).toBeOnTheScreen();
    await waitFor(() => {
      expect(calls.map((call) => call.operation)).toContain('MarkMyMessagesRead');
    });
  });

  it('sends a message with the topic you picked and empties the box', async () => {
    const calls = api([]);
    await renderApp(<MessageWindow />);
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    // Question is picked to start with.
    expect(screen.getByRole('radio', { name: 'Question' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'Something is broken' }));
    expect(screen.getByRole('radio', { name: 'Something is broken' })).toBeChecked();
    await fireEvent.changeText(screen.getByLabelText('Your message'), '  The PDF is empty  ');
    await fireEvent.press(send);

    expect(await screen.findByText('The PDF is empty')).toBeOnTheScreen();
    expect(screen.getByText(/^Something is broken · /)).toBeOnTheScreen();
    expect(screen.getByLabelText('Your message')).toHaveDisplayValue('');
    expect(calls.find((call) => call.operation === 'SendMessage')?.variables).toEqual({
      input: { topic: 'BROKEN', body: 'The PDF is empty' },
    });
    // Nothing unread: nothing to mark.
    expect(calls.map((call) => call.operation)).not.toContain('MarkMyMessagesRead');
  });

  it('shows why a message was not sent and keeps your text', async () => {
    fakeApi({
      Me: () => ({ data: { me: user } }),
      MyMessages: () => ({ data: { myMessages: { items: [], unread: 0 } } }),
      SendMessage: () => ({
        errors: [{ message: 'Too many messages', extensions: { code: 'X' } }],
      }),
    });
    await renderApp(<MessageWindow />);
    await fireEvent.changeText(screen.getByLabelText('Your message'), 'Hello');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many messages/);
    expect(screen.getByLabelText('Your message')).toHaveDisplayValue('Hello');
  });

  it('closes back to where you came from, or to the jobs', async () => {
    api([]);
    await renderApp(<MessageWindow />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalled();

    jest.mocked(router.canGoBack).mockReturnValueOnce(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
