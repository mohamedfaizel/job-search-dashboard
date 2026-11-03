import { ApplicationStatus } from '../generated/prisma/enums';

/** Days in Applied with no change (or since your last follow-up) before "Follow up?" shows. */
export const FOLLOW_UP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when it's time to follow up: you applied, and nothing happened for FOLLOW_UP_DAYS since
 * then or since you last followed up. Other statuses never ask (the employer already replied).
 */
export function isFollowUpDue(
  app: { status: ApplicationStatus; statusChangedAt: Date; followedUpAt: Date | null },
  now: Date,
): boolean {
  if (app.status !== ApplicationStatus.APPLIED) return false;
  const since = Math.max(app.statusChangedAt.getTime(), app.followedUpAt?.getTime() ?? 0);
  return now.getTime() - since >= FOLLOW_UP_DAYS * DAY_MS;
}
