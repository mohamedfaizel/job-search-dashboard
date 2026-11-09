import type { JobSource } from '../generated/prisma/enums';
import { ApplicationStatus } from '../generated/prisma/enums';

const DAY_MS = 86_400_000;

/** One tracked job: where it is now, where it came from, and each status it moved to. */
export interface FunnelApp {
  status: ApplicationStatus;
  source: JobSource;
  events: { status: ApplicationStatus; at: Date }[];
}

export interface FunnelCounts {
  /** Jobs that got this far (an offer also counts as applied and interviewed). */
  applied: number;
  interviews: number;
  offers: number;
}

export interface Funnel extends FunnelCounts {
  /** Every job on your tracker. */
  tracked: number;
  rejected: number;
  /** Applied, and no interview, offer or rejection yet. */
  waiting: number;
  /** Share of applications that got any answer (interview, offer or rejection), 0 to 1. */
  responseRate: number | null;
  /** Share of applications that got an interview, 0 to 1. */
  interviewRate: number | null;
  /** Share of interviews that became an offer, 0 to 1. */
  offerRate: number | null;
  /** Middle number of days from applying to the first answer. */
  medianDaysToReply: number | null;
  appliedLast7Days: number;
  appliedLast30Days: number;
  bySource: (FunnelCounts & { source: JobSource })[];
}

const AFTER_APPLY: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.INTERVIEWING,
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
];
const ANSWERS: ApplicationStatus[] = [
  ApplicationStatus.INTERVIEWING,
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
];

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** How far one job got, when you applied and when the first answer came. */
function stagesOf(app: FunnelApp) {
  const events = [...app.events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const reached = new Set([app.status, ...events.map((e) => e.status)]);
  const applied = AFTER_APPLY.some((status) => reached.has(status));
  const interview =
    reached.has(ApplicationStatus.INTERVIEWING) || reached.has(ApplicationStatus.OFFER);
  const offer = reached.has(ApplicationStatus.OFFER);
  const appliedAt = events.find((e) => AFTER_APPLY.includes(e.status))?.at ?? null;
  const sentAt = events.find((e) => e.status === ApplicationStatus.APPLIED)?.at ?? null;
  const answerAt = sentAt
    ? (events.find((e) => ANSWERS.includes(e.status) && e.at >= sentAt)?.at ?? null)
    : null;
  return {
    applied,
    interview,
    offer,
    answered: applied && (interview || reached.has(ApplicationStatus.REJECTED)),
    appliedAt,
    daysToReply:
      sentAt && answerAt
        ? Math.round(((answerAt.getTime() - sentAt.getTime()) / DAY_MS) * 10) / 10
        : null,
  };
}

/** Your job search funnel: how many applications got an answer, an interview, an offer. */
export function funnelStats(apps: FunnelApp[], now = new Date()): Funnel {
  const stages = apps.map((app) => ({ app, ...stagesOf(app) }));
  const applied = stages.filter((s) => s.applied);
  const interviews = stages.filter((s) => s.interview).length;
  const offers = stages.filter((s) => s.offer).length;
  const since = (days: number) =>
    applied.filter((s) => s.appliedAt && now.getTime() - s.appliedAt.getTime() <= days * DAY_MS)
      .length;
  const sources = [...new Set(stages.map((s) => s.app.source))].sort();
  return {
    tracked: apps.length,
    applied: applied.length,
    interviews,
    offers,
    rejected: apps.filter((app) => app.status === ApplicationStatus.REJECTED).length,
    waiting: applied.filter((s) => !s.answered).length,
    responseRate: rate(applied.filter((s) => s.answered).length, applied.length),
    interviewRate: rate(interviews, applied.length),
    offerRate: rate(offers, interviews),
    medianDaysToReply: median(
      stages.flatMap((s) => (s.daysToReply === null ? [] : [s.daysToReply])),
    ),
    appliedLast7Days: since(7),
    appliedLast30Days: since(30),
    bySource: sources.map((source) => {
      const mine = stages.filter((s) => s.app.source === source);
      return {
        source,
        applied: mine.filter((s) => s.applied).length,
        interviews: mine.filter((s) => s.interview).length,
        offers: mine.filter((s) => s.offer).length,
      };
    }),
  };
}
