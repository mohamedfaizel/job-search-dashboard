import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AttemptLimiter, AuthLimits } from './attempt-limiter';

describe('AttemptLimiter', () => {
  it('lets the first tries through, then blocks with TOO_MANY_TRIES (429)', () => {
    let now = 0;
    const limiter = new AttemptLimiter(3, 60_000, () => now);
    limiter.hit('a');
    limiter.hit('a');
    limiter.hit('a');
    let thrown: unknown;
    try {
      limiter.hit('a');
    } catch (error) {
      thrown = error;
    }
    const error = thrown as { getStatus: () => number; getResponse: () => unknown };
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(error.getResponse()).toMatchObject({ code: 'TOO_MANY_TRIES', params: { minutes: 1 } });
    // Other keys are not affected.
    expect(() => {
      limiter.hit('b');
    }).not.toThrow();
    // After the window, tries are allowed again.
    now = 60_000;
    expect(() => {
      limiter.hit('a');
    }).not.toThrow();
  });

  it('forgets the count after a reset (a correct login)', () => {
    const limiter = new AttemptLimiter(1, 60_000, () => 0);
    limiter.hit('a');
    limiter.reset('a');
    expect(() => {
      limiter.hit('a');
    }).not.toThrow();
  });
});

describe('AttemptLimiter memory', () => {
  it('forgets keys whose tries are all old once it holds many keys', () => {
    let now = 0;
    const limiter = new AttemptLimiter(1, 1_000, () => now, 2);
    limiter.hit('a');
    limiter.hit('b');
    now = 5_000;
    limiter.hit('c'); // 3 keys > 2: 'a' and 'b' are old and dropped
    now = 5_001;
    expect(() => {
      limiter.hit('a');
    }).not.toThrow();
    expect(() => {
      limiter.hit('c');
    }).toThrow();
  });
});

const code = (fn: () => void): unknown => {
  try {
    fn();
  } catch (error) {
    return (error as { getResponse: () => { code: string } }).getResponse().code;
  }
  return null;
};

describe('AuthLimits', () => {
  it('allows 10 tries per email, and a correct login resets them', () => {
    const limits = new AuthLimits(true, () => 0);
    for (let i = 0; i < 10; i++) limits.logIn('1.2.3.4', 'Ana@Example.com ');
    expect(code(() => limits.logIn('1.2.3.4', 'ana@example.com'))).toBe('TOO_MANY_TRIES');
    // Another email from the same address still works.
    expect(code(() => limits.logIn('1.2.3.4', 'bo@example.com'))).toBeNull();
    const key = limits.logIn('5.6.7.8', 'cy@example.com');
    limits.loggedIn(key);
    expect(key).toBe('5.6.7.8|cy@example.com');
  });

  it('allows 50 login tries per address over all emails', () => {
    const limits = new AuthLimits(true, () => 0);
    for (let i = 0; i < 50; i++) limits.logIn('1.2.3.4', `u${String(i)}@example.com`);
    expect(code(() => limits.logIn('1.2.3.4', 'new@example.com'))).toBe('TOO_MANY_TRIES');
  });

  it('allows 10 sign-ups an hour per address', () => {
    const limits = new AuthLimits(true, () => 0);
    for (let i = 0; i < 10; i++) limits.signUp('1.2.3.4');
    expect(
      code(() => {
        limits.signUp('1.2.3.4');
      }),
    ).toBe('TOO_MANY_TRIES');
  });

  it('counts nothing when off (tests)', () => {
    const limits = new AuthLimits(false, () => 0);
    for (let i = 0; i < 100; i++) {
      limits.signUp('1.2.3.4');
      limits.logIn('1.2.3.4', 'a@example.com');
    }
    expect(code(() => limits.logIn('1.2.3.4', 'a@example.com'))).toBeNull();
  });
});
