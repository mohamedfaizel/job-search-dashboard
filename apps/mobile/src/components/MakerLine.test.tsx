import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fakeApi, user } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { MakerLine } from './MakerLine';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('MakerLine', () => {
  it('says who made the app and opens the message window', async () => {
    fakeApi({ Me: () => ({ data: { me: user } }) });
    await renderApp(<MakerLine />);
    expect(screen.getByText('Made by Mohamed Faizel')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Queries and suggestions welcome ›' }));
    expect(router.push).toHaveBeenCalledWith('/messages');
  });

  it('speaks German for a German account', async () => {
    fakeApi({ Me: () => ({ data: { me: { ...user, locale: 'de' } } }) });
    await renderApp(<MakerLine />);
    expect(await screen.findByText('Entwickelt von Mohamed Faizel')).toBeOnTheScreen();
    expect(screen.getByText('Fragen und Vorschläge willkommen ›')).toBeOnTheScreen();
  });
});
