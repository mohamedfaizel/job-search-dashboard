import { HttpException, HttpStatus } from '@nestjs/common';
import { apiError } from '../common/api-error';

/** Blocks password guessing: after `max` tries in `windowMs`, wait until the window ends. */
export class AttemptLimiter {
  private readonly tries = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
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
    if (this.tries.size > 10_000) {
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

/** HTTP 429 "Too Many Requests". */
class TooManyTries extends HttpException {
  constructor(body: object) {
    super(body, HttpStatus.TOO_MANY_REQUESTS);
  }
}
