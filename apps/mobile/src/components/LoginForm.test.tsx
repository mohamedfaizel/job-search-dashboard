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
    expect(screen.getByText('Server: http://api.test/graphql')).toBeOnTheScreen();

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

  it('says when it can’t reach the API, and where it looked', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await renderApp(<LoginForm />);
    await fillIn('ada@example.com', 'secret123');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Can’t reach the API at http:\/\/api\.test\/graphql/,
    );
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
