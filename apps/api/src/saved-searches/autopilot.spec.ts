import { describe, expect, it } from 'vitest';
import type { AutopilotJob, AutopilotRules } from './autopilot';
import { choose, plan, sameTitle } from './autopilot';

const rules: AutopilotRules = {
  autoQueueFitMin: 75,
  autoQueueNeedsVisa: true,
  autoHideFitBelow: 40,
};
const job = (over: Partial<AutopilotJob>): AutopilotJob => ({
  id: 'j',
  fit: 60,
  visa: 'NOT_STATED',
  closed: false,
  duplicate: false,
  handled: false,
  ...over,
});

describe('choose', () => {
  it('queues a good fit and hides a poor one', () => {
    expect(choose(rules, job({ fit: 80 }))).toBe('QUEUE');
    expect(choose(rules, job({ fit: 75 }))).toBe('QUEUE');
    expect(choose(rules, job({ fit: 39 }))).toBe('HIDE');
    expect(choose(rules, job({ fit: 40 }))).toBe('KEEP');
  });

  it('does not queue a job that says no visa, unless the rule is off', () => {
    expect(choose(rules, job({ fit: 90, visa: 'NO' }))).toBe('KEEP');
    expect(choose({ ...rules, autoQueueNeedsVisa: false }, job({ fit: 90, visa: 'NO' }))).toBe(
      'QUEUE',
    );
  });

  it('hides closed jobs and duplicates, even with a high fit', () => {
    expect(choose(rules, job({ fit: 90, closed: true }))).toBe('HIDE');
    expect(choose(rules, job({ fit: 90, duplicate: true }))).toBe('HIDE');
  });

  it('leaves jobs you already handled, and jobs with no score', () => {
    expect(choose(rules, job({ fit: 10, handled: true }))).toBe('KEEP');
    expect(choose(rules, job({ fit: null }))).toBe('KEEP');
  });

  it('hides nothing for its Fit when the hide limit is 0', () => {
    expect(choose({ ...rules, autoHideFitBelow: 0 }, job({ fit: 1 }))).toBe('KEEP');
  });
});

describe('plan', () => {
  it('queues the best fits up to the free slots and keeps the rest', () => {
    const result = plan(
      rules,
      [
        job({ id: 'a', fit: 76 }),
        job({ id: 'b', fit: 92 }),
        job({ id: 'c', fit: 81 }),
        job({ id: 'd', fit: 20 }),
        job({ id: 'e', fit: 50 }),
      ],
      2,
    );
    expect(result.queue).toEqual(['b', 'c']);
    expect(result.hide).toEqual(['d']);
    expect(result.keep).toEqual(['e', 'a']);
  });

  it('queues nothing when the daily limit is used up', () => {
    expect(plan(rules, [job({ id: 'a', fit: 90 })], 0).queue).toEqual([]);
    expect(plan(rules, [job({ id: 'a', fit: 90 })], -3).keep).toEqual(['a']);
  });
});

describe('sameTitle', () => {
  it('ignores case, spaces and the (m/w/d) tag', () => {
    expect(sameTitle('Data Engineer (m/w/d)')).toBe(sameTitle('data  engineer'));
    expect(sameTitle('Data Engineer (f/m/x)')).toBe('data engineer');
    expect(sameTitle('Data Engineer')).not.toBe(sameTitle('Senior Data Engineer'));
  });
});
