import { registerEnumType } from '@nestjs/graphql';
import { ScheduleFrequency } from '../generated/prisma/enums';

registerEnumType(ScheduleFrequency, {
  name: 'ScheduleFrequency',
  description: 'How often a saved search runs by itself',
});

export { ScheduleFrequency };

/** "07:30" → [7, 30]. Validated before it gets here. */
function parseRunAt(runAt: string): [number, number] {
  const [hours = 0, minutes = 0] = runAt.split(':').map(Number);
  return [hours, minutes];
}

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

/**
 * The next time after `from` that a schedule fires, in the server's local time:
 * HOURLY at runAt's minute past every hour, DAILY at runAt, WEEKDAYS at runAt Monday to Friday.
 */
export function nextRunAfter(schedule: ScheduleFrequency, runAt: string, from: Date): Date | null {
  const [hours, minutes] = parseRunAt(runAt);
  const next = new Date(from);
  next.setSeconds(0, 0);

  switch (schedule) {
    case ScheduleFrequency.OFF:
      return null;
    case ScheduleFrequency.HOURLY:
      next.setMinutes(minutes);
      if (next <= from) next.setHours(next.getHours() + 1);
      return next;
    case ScheduleFrequency.DAILY:
    case ScheduleFrequency.WEEKDAYS:
      next.setHours(hours, minutes);
      while (next <= from || (schedule === ScheduleFrequency.WEEKDAYS && isWeekend(next))) {
        next.setDate(next.getDate() + 1);
      }
      return next;
  }
}

/** Midnight at the start of `now`'s day, in the server's local time. */
export function startOfDay(now: Date): Date {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
}
