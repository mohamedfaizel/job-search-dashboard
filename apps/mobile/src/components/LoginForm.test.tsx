import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Localization from 'expo-localization';
import { router } from 'expo-router';
import { fakeApi, user } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { LoginForm } from './LoginForm';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

afterEach(() => {
  jest.restoreAllMocks();
});

async function fillIn(email: string, password: string) {
  await fireEvent.changeText(await screen.findByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
}

describe('LoginForm', () => {
  it('logs in with the website account and opens the jobs', async () => {
    const calls = fakeApi({
      Me: () => ({ data: { me: null } }),
      LogIn: () => ({ data: { logIn: user } }),
    });
    await renderApp(<LoginForm />);
    expect(await screen.findByText('Log in to Job Search Hunter')).toBeOnTheScreen();
    expect(screen.queryByText(/api\.test|Server:/)).toBeNull();

    await fillIn(' ada@example.com ', 'secret123');

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/');
    });
    expect(calls).toContainEqual({
      operation: 'LogIn',
      variables: { input: { email: 'ada@example.com', password: 'secret123' } },
    });
  });

  it('waits for both fields before it lets you log in', async () => {
    fakeApi({ Me: () => ({ data: { me: null } }) });
    await renderApp(<LoginForm />);
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'ada@example.com');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled();
  });

  it('says when the email or password is wrong', async () => {
    fakeApi({
      Me: () => ({ data: { me: null } }),
      LogIn: () => ({
        errors: [{ message: 'Wrong email or password', extensions: { apiCode: 'WRONG_LOGIN' } }],
      }),
    });
    await renderApp(<LoginForm />);
    await fillIn('ada@example.com', 'nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
  });

  it('says in plain words when it can’t connect, and offers Try again', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await renderApp(<LoginForm />);
    await fillIn('ada@example.com', 'secret123');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Can’t connect right nowCheck your internet and try again in a minute.',
    );
    expect(alert).not.toHaveTextContent(/api\.test|pnpm|API/);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('says it can’t connect in German too', async () => {
    jest
      .spyOn(Localization, 'getLocales')
      .mockReturnValue([{ languageCode: 'de' } as Localization.Locale]);
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await renderApp(<LoginForm />);
    await fireEvent.changeText(await screen.findByLabelText('E-Mail'), 'ada@example.com');
    await fireEvent.changeText(screen.getByLabelText('Passwort'), 'secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'Anmelden' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Gerade keine Verbindung/);
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeOnTheScreen();
  });

  it('speaks German on a German phone', async () => {
    jest
      .spyOn(Localization, 'getLocales')
      .mockReturnValue([{ languageCode: 'de' } as Localization.Locale]);
    fakeApi({ Me: () => ({ data: { me: null } }) });
    await renderApp(<LoginForm />);
    expect(await screen.findByText('Bei Job Search Hunter anmelden')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeOnTheScreen();
  });
});
