import type { Prisma } from '../generated/prisma/client';

/**
 * Only the jobs on this user's list: the ones they imported or added. Every lookup of one job by
 * its id adds this, so a job id from someone else's list reads as "not found".
 */
export function listedFor(userId: number) {
  return { listedFor: { some: { userId } } } satisfies Prisma.JobWhereInput;
}
