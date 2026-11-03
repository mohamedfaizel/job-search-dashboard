import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long you have to finish signing in at Google. */
export const STATE_MINUTES = 10;

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

/**
 * The "state" Google sends back after sign-in. It says which user started it (so nobody can
 * attach their Gmail to someone else's account) and is signed, so it can't be forged or reused later.
 */
export function makeState(userId: number, secret: string, now = new Date()): string {
  const payload = `${userId}.${now.getTime() + STATE_MINUTES * 60_000}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The user id inside a valid, unexpired state, or null. */
export function readState(state: string, secret: string, now = new Date()): number | null {
  const [id, expires, signature] = state.split('.');
  if (!id || !expires || !signature) return null;
  const expected = Buffer.from(sign(`${id}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expires) < now.getTime()) return null;
  const userId = Number(id);
  return Number.isInteger(userId) ? userId : null;
}
