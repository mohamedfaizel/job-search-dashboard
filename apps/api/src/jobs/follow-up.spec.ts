import { describe, expect, it } from 'vitest';
import { ApplicationStatus } from '../generated/prisma/enums';
import { isFollowUpDue } from './follow-up';

const now = new Date('2026-11-10T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe('isFollowUpDue', () => {
  it('asks after 7 days in Applied', () => {
    const app = { status: ApplicationStatus.APPLIED, followedUpAt: null };
    expect(isFollowUpDue({ ...app, statusChangedAt: daysAgo(6) }, now)).toBe(false);
    expect(isFollowUpDue({ ...app, statusChangedAt: daysAgo(7) }, now)).toBe(true);
  });

  it('waits another 7 days after you followed up', () => {
    const app = { status: ApplicationStatus.APPLIED, statusChangedAt: daysAgo(20) };
    expect(isFollowUpDue({ ...app, followedUpAt: daysAgo(3) }, now)).toBe(false);
    expect(isFollowUpDue({ ...app, followedUpAt: daysAgo(8) }, now)).toBe(true);
  });

  it('never asks for other statuses', () => {
    for (const status of [
      ApplicationStatus.SAVED,
      ApplicationStatus.INTERVIEWING,
      ApplicationStatus.REJECTED,
    ]) {
      expect(isFollowUpDue({ status, statusChangedAt: daysAgo(30), followedUpAt: null }, now)).toBe(
        false,
      );
    }
  });
});
