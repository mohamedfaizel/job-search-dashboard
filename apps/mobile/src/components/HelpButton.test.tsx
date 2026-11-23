import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeApi, user } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { HelpButton } from './HelpButton';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HelpButton', () => {
  it('opens Queries and suggestions', async () => {
    fakeApi({ Me: () => ({ data: { me: user } }) });
    await renderApp(<HelpButton />);
    await fireEvent.press(screen.getByRole('button', { name: 'Queries and suggestions' }));
    expect(router.push).toHaveBeenCalledWith('/messages');
  });

  it('speaks German for a German account', async () => {
    fakeApi({ Me: () => ({ data: { me: { ...user, locale: 'de' } } }) });
    await renderApp(<HelpButton />);
    expect(await screen.findByRole('button', { name: 'Fragen und Vorschläge' })).toBeOnTheScreen();
  });
});
