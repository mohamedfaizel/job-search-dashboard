import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AttemptLimiter } from './attempt-limiter';

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
