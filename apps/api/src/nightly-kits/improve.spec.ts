import { describe, expect, it } from 'vitest';
import { buildImprovePrompt, honestMissing } from './improve';

const check = (term: string, inResume: boolean, youHave = false) => ({
  term,
  inResume,
  youHave,
  relatedTo: null,
});

describe('honestMissing', () => {
  it('keeps only missing terms your master resume or skills list backs', () => {
    const before = [check('airflow', true), check('dbt', false, true), check('kafka', false)];
    expect(honestMissing(before, ['airflow', 'dbt', 'kafka'])).toEqual(['airflow', 'dbt']);
    expect(honestMissing(before, ['kafka'])).toEqual([]);
  });
});

describe('buildImprovePrompt', () => {
  it('lists the terms, forbids made-up facts and keeps language levels', () => {
    const prompt = buildImprovePrompt({
      title: 'Data Engineer',
      company: 'Acme',
      resume: 'Data Engineer. Python.',
      score: 78,
      target: 90,
      terms: ['airflow'],
      master: 'Python, Airflow.',
      languages: ['German (A2)'],
    });
    expect(prompt).toContain('covers 78%');
    expect(prompt).toContain('- airflow');
    expect(prompt).toContain('Keep my languages and their levels exactly: German (A2)');
    expect(prompt).toContain('=== MY MASTER RESUME');
  });
});
