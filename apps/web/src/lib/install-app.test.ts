import { act, renderHook } from '@testing-library/react';
import { useInstallApp } from './install-app';

/** A fake beforeinstallprompt event; `outcome` is what the person picks in the browser's dialog. */
function offer(outcome: 'accepted' | 'dismissed') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

const userAgent = navigator.userAgent;

afterEach(() => {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useInstallApp', () => {
  it('offers the browser prompt and becomes installed when accepted', async () => {
    const { result } = renderHook(() => useInstallApp());
    expect(result.current.state).toBe('none');

    const event = offer('accepted');
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.state).toBe('prompt');

    await act(() => result.current.install());
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(result.current.state).toBe('installed');
  });

  it('goes back to none when the person dismisses the prompt', async () => {
    const { result } = renderHook(() => useInstallApp());
    offer('dismissed');
    await act(() => result.current.install());
    expect(result.current.state).toBe('none');
    // Without a kept prompt, install does nothing.
    await act(() => result.current.install());
    expect(result.current.state).toBe('none');
  });

  it('notices an install done from the browser menu', () => {
    const { result } = renderHook(() => useInstallApp());
    offer('accepted');
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.state).toBe('installed');
  });

  it('shows the iPhone hint on iOS, and nothing once it runs from the home screen', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      configurable: true,
    });
    expect(renderHook(() => useInstallApp()).result.current.state).toBe('ios');

    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    expect(renderHook(() => useInstallApp()).result.current.state).toBe('installed');
  });

  it('knows it runs installed when the window is standalone', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: (query: string) => ({ matches: query === '(display-mode: standalone)' }),
      configurable: true,
    });
    expect(renderHook(() => useInstallApp()).result.current.state).toBe('installed');
  });
});
