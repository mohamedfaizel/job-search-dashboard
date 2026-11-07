import { describe, expect, it } from 'vitest';
import { loadSearchResponse } from '../../test/fixtures/load';
import { mapJobHunterJob } from './jobhunter.mapper';
import type { JobHunterJob } from './jobhunter.types';

const [remoteJob, hybridJob, plainJob] = loadSearchResponse().data as [
  JobHunterJob,
  JobHunterJob,
  JobHunterJob,
];

describe('mapJobHunterJob', () => {
  it('maps the core fields of a posting', () => {
    const { company, job } = mapJobHunterJob(remoteJob);

    expect(company).toEqual({ name: 'Protofy GmbH & Co. KG', domain: null, logoUrl: null });
    expect(job).toMatchObject({
      externalId: '8a5adb17ca3a27ec',
      source: 'JOBHUNTER',
      title: 'Lead Frontend / Fullstack Engineer',
      city: 'Berlin',
      countryCode: 'DE',
      language: 'de',
      seniority: 'director',
      jobFunction: 'Engineering',
      provider: 'indeed',
      industry: 'Computer programming, consultancy and related activities',
      postingStatus: 'active',
    });
    expect(job.postedAt).toEqual(new Date('2026-10-23T12:01:55+00:00'));
    expect(job.skills).toEqual(['react', 'node.js', 'flutter', 'kotlin']);
  });

  it('reads the workplace from work_arrangement', () => {
    expect(mapJobHunterJob(remoteJob).job.workplace).toBe('REMOTE');
    expect(mapJobHunterJob(hybridJob).job.workplace).toBe('HYBRID');
  });

  it('falls back to the remote/hybrid flags, then to unknown', () => {
    expect(mapJobHunterJob({ ...plainJob, remote: true }).job.workplace).toBe('REMOTE');
    expect(mapJobHunterJob(plainJob).job.workplace).toBeNull();
  });

  it('uses the company logo when JobHunter has one', () => {
    expect(mapJobHunterJob(hybridJob).company.logoUrl).toMatch(/^https:\/\//);
  });

  it('flags estimated salaries', () => {
    const { job } = mapJobHunterJob(remoteJob);
    expect(job.salaryEstimated).toBe(true);
    expect(job.salaryMinUsd).toBe(remoteJob.estimated_min_annual_salary_usd);
  });

  it('prefers the salary stated in the ad', () => {
    const { job } = mapJobHunterJob({
      ...remoteJob,
      min_annual_salary_usd: 70_000,
      max_annual_salary_usd: 95_000,
    });
    expect(job).toMatchObject({
      salaryMinUsd: 70_000,
      salaryMaxUsd: 95_000,
      salaryEstimated: false,
    });
  });
});
