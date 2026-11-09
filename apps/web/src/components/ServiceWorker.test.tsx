import { render } from '@testing-library/react';
import { ServiceWorker } from './ServiceWorker';

const register = vi.fn(() => Promise.resolve({}));

beforeEach(() => {
  Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('ServiceWorker', () => {
  it('registers /sw.js in a production build', () => {
    render(<ServiceWorker enabled />);
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('stays off in development', () => {
    render(<ServiceWorker />);
    expect(register).not.toHaveBeenCalled();
  });

  it('keeps the app working when registering fails', async () => {
    register.mockReturnValueOnce(Promise.reject(new Error('blocked')));
    render(<ServiceWorker enabled />);
    await Promise.resolve();
    expect(register).toHaveBeenCalledOnce();
  });
});
