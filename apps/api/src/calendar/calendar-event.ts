/** How long an interview event lasts in the calendar; you can stretch it there. */
export const INTERVIEW_MINUTES = 60;
/** The prep notes go in the event, cut here so the event stays readable (Google allows ~8 KB). */
const PREP_MAX = 4000;

export interface InterviewInfo {
  title: string;
  company: string;
  at: Date;
  /** The job in this app (Interview tab). */
  jobLink: string;
  /** The ad on the employer's or job board's site, when we have it. */
  adUrl: string | null;
  /** Your saved interview prep, if any. */
  prep: string | null;
}

export interface CalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string };
  end: { dateTime: string };
  reminders: { useDefault: boolean };
  source: { title: string; url: string };
}

/** The Google Calendar event for one interview: title, time, links and your prep notes. */
export function interviewEvent(info: InterviewInfo): CalendarEvent {
  const end = new Date(info.at.getTime() + INTERVIEW_MINUTES * 60_000);
  const lines = [
    `${info.title} · ${info.company}`,
    '',
    `Open in Job Search Hunter: ${info.jobLink}`,
  ];
  if (info.adUrl) lines.push(`Job ad: ${info.adUrl}`);
  const prep = info.prep?.trim();
  if (prep) {
    const cut = prep.length > PREP_MAX ? `${prep.slice(0, PREP_MAX).trimEnd()}…` : prep;
    lines.push('', 'Your interview prep:', cut);
  }
  return {
    summary: `Interview: ${info.title} · ${info.company}`,
    description: lines.join('\n'),
    start: { dateTime: info.at.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: { useDefault: true },
    source: { title: 'Job Search Hunter', url: info.jobLink },
  };
}
