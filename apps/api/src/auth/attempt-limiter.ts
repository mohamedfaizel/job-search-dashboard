import { HttpException, HttpStatus } from '@nestjs/common';
import { apiError } from '../common/api-error';

/** Blocks password guessing: after `max` tries in `windowMs`, wait until the window ends. */
export class AttemptLimiter {
  private readonly tries = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

  /** Throws TOO_MANY_TRIES when `key` already used up its tries; otherwise counts this one. */
  hit(key: string): void {
    const now = this.now();
    const recent = (this.tries.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      const minutes = Math.max(1, Math.ceil(((recent[0] ?? now) + this.windowMs - now) / 60_000));
      this.tries.set(key, recent);
      throw apiError(
        TooManyTries,
        'TOO_MANY_TRIES',
        `Too many tries. Wait ${String(minutes)} minutes and try again.`,
        { minutes },
      );
    }
    recent.push(now);
    this.tries.set(key, recent);
    // Keep memory small: forget keys whose tries are all old.
    if (this.tries.size > this.maxKeys) {
      for (const [k, list] of this.tries) {
        if (list.every((t) => now - t >= this.windowMs)) this.tries.delete(k);
      }
    }
  }

  /** A correct login clears the count for that key. */
  reset(key: string): void {
    this.tries.delete(key);
  }
}

const MINUTE = 60_000;

/**
 * The login and sign-up limits. One address may try one email 10 times, and any emails 50 times,
 * in 15 minutes, and make 10 accounts an hour. Off (`enabled` false) in tests, which sign up and
 * log in many times from one address.
 */
export class AuthLimits {
  private readonly login: AttemptLimiter;
  private readonly address: AttemptLimiter;
  private readonly signUps: AttemptLimiter;

  constructor(
    private readonly enabled: boolean,
    now: () => number = Date.now,
  ) {
    this.login = new AttemptLimiter(10, 15 * MINUTE, now);
    this.address = new AttemptLimiter(50, 15 * MINUTE, now);
    this.signUps = new AttemptLimiter(10, 60 * MINUTE, now);
  }

  /** Counts a sign-up from `address`; throws TOO_MANY_TRIES past the limit. */
  signUp(address: string): void {
    if (this.enabled) this.signUps.hit(address);
  }

  /** Counts a login try; returns the key to pass to `loggedIn` when the password was right. */
  logIn(address: string, email: string): string {
    const key = `${address}|${email.trim().toLowerCase()}`;
    if (this.enabled) {
      this.address.hit(address);
      this.login.hit(key);
    }
    return key;
  }

  /** A correct login clears the count for that email. */
  loggedIn(key: string): void {
    this.login.reset(key);
  }
}

/** HTTP 429 "Too Many Requests". */
class TooManyTries extends HttpException {
  constructor(body: object) {
    super(body, HttpStatus.TOO_MANY_REQUESTS);
  }
}
