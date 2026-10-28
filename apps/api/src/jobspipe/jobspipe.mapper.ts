import type { Prisma } from '../generated/prisma/client';
import { JobSource, Workplace } from '../generated/prisma/enums';
import { detectLanguage } from '../insights/text';
import type { JobsPipeJob } from './jobspipe.types';

export interface MappedCompany {
  name: string;
  domain: string | null;
  logoUrl: string | null;
}

export interface MappedJob {
  company: MappedCompany;
  job: Omit<Prisma.JobUncheckedCreateInput, 'companyId'> & { externalId: string };
}

function toWorkplace(raw: JobsPipeJob): Workplace | null {
  switch (raw.work_arrangement) {
    case 'remote':
      return Workplace.REMOTE;
    case 'hybrid':
      return Workplace.HYBRID;
    case 'on_site':
    case 'onsite':
      return Workplace.ONSITE;
  }
  // Older postings only set the boolean flags.
  if (raw.remote) return Workplace.REMOTE;
  if (raw.hybrid) return Workplace.HYBRID;
  return null;
}

/** Prefer the salary stated in the ad; fall back to JobsPipe's estimate and flag it. */
function toSalary(raw: JobsPipeJob) {
  if (raw.min_annual_salary_usd !== null || raw.max_annual_salary_usd !== null) {
    return {
      salaryMinUsd: raw.min_annual_salary_usd,
      salaryMaxUsd: raw.max_annual_salary_usd,
      salaryEstimated: false,
    };
  }
  const min = raw.estimated_min_annual_salary_usd;
  const max = raw.estimated_max_annual_salary_usd;
  return { salaryMinUsd: min, salaryMaxUsd: max, salaryEstimated: min !== null || max !== null };
}

/** Converts one JobsPipe posting into the shape we store. Pure function: easy to unit test. */
export function mapJobsPipeJob(raw: JobsPipeJob): MappedJob {
  return {
    company: {
      name: raw.company_object?.name ?? raw.company,
      domain: raw.company_domain ?? raw.company_object?.domain ?? null,
      logoUrl: raw.company_object?.logo ?? null,
    },
    job: {
      externalId: raw.id,
      source: JobSource.JOBSPIPE,
      title: raw.job_title,
      url: raw.url,
      postedAt: new Date(raw.date_posted),
      seniority: raw.seniority,
      jobFunction: raw.job_function,
      skills: raw.technology_slugs ?? [],
      city: raw.normalized_city ?? raw.cities?.[0] ?? raw.short_location,
      location: raw.long_location,
      countryCode: raw.country_code,
      language: raw.language?.toLowerCase() ?? detectLanguage(raw.description),
      ...toSalary(raw),
      provider: raw.sources?.[0]?.provider ?? null,
      workplace: toWorkplace(raw),
      industry: raw.isic_division_label,
      description: raw.description,
      postingStatus: raw.status ?? 'active',
      raw: raw as unknown as Prisma.InputJsonValue,
    },
  };
}
