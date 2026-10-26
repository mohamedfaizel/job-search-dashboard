import { describe, expect, it } from 'vitest';
import { nextRunAfter, ScheduleFrequency } from './schedule';

// Local-time dates, like the scheduler uses. Oct 26, 2026 is a Monday.
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes);

describe('nextRunAfter', () => {
  it('is null when the schedule is off', () => {
    expect(nextRunAfter(ScheduleFrequency.OFF, '07:00', at(26, 6))).toBeNull();
  });

  it('runs daily at the chosen time, today if it is still ahead', () => {
    expect(nextRunAfter(ScheduleFrequency.DAILY, '07:30', at(26, 6))).toEqual(at(26, 7, 30));
    expect(nextRunAfter(ScheduleFrequency.DAILY, '07:30', at(26, 7, 30))).toEqual(at(27, 7, 30));
    expect(nextRunAfter(ScheduleFrequency.DAILY, '07:30', at(26, 20))).toEqual(at(27, 7, 30));
  });

  it('skips Saturday and Sunday on weekdays', () => {
    // Friday evening → Monday morning.
    expect(nextRunAfter(ScheduleFrequency.WEEKDAYS, '07:00', at(30, 20))).toEqual(
      new Date(2026, 10, 2, 7, 0),
    );
    expect(nextRunAfter(ScheduleFrequency.WEEKDAYS, '07:00', at(27, 6))).toEqual(at(27, 7));
  });

  it('runs hourly at the chosen minute', () => {
    expect(nextRunAfter(ScheduleFrequency.HOURLY, '07:15', at(26, 9, 10))).toEqual(at(26, 9, 15));
    expect(nextRunAfter(ScheduleFrequency.HOURLY, '07:15', at(26, 9, 15))).toEqual(at(26, 10, 15));
    expect(nextRunAfter(ScheduleFrequency.HOURLY, '07:15', at(26, 23, 40))).toEqual(at(27, 0, 15));
  });
});
