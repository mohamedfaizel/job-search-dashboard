import type { CreateJobInput, SyncJobsInput } from '@jobsearch/data';
import { APPLICATION_STATUSES, WORKPLACES } from '@jobsearch/data';
import { z } from 'zod';

/** Splits "react, node.js ,  " into ["react", "node.js"]. */
export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const optionalText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);

const salary = z
  .string()
  .trim()
  .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 10_000_000), {
    message: 'Enter a yearly amount in USD, digits only',
  });

export const SENIORITIES = ['intern', 'junior', 'mid', 'senior', 'lead', 'director', 'executive'];

/**
 * Validation rules for the add-job form. The form works with strings (that's what inputs
 * hold); toCreateJobInput converts them to the API's types.
 */
export const jobFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Job title is required').max(300),
    companyName: z.string().trim().min(1, 'Company is required').max(200),
    url: z.union([z.literal(''), z.url({ message: 'Enter a full link, starting with https://' })]),
    city: optionalText(100),
    countryCode: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[A-Za-z]{2}$/.test(v), {
        message: 'Use a 2-letter code, like US or DE',
      }),
    workplace: z.union([z.literal(''), z.enum(WORKPLACES)]),
    seniority: z.string(),
    jobFunction: optionalText(100),
    industry: optionalText(200),
    skills: z.string(),
    salaryMinUsd: salary,
    salaryMaxUsd: salary,
    description: optionalText(50_000),
    applicationStatus: z.enum(APPLICATION_STATUSES),
  })
  .refine(
    (v) =>
      v.salaryMinUsd === '' ||
      v.salaryMaxUsd === '' ||
      Number(v.salaryMinUsd) <= Number(v.salaryMaxUsd),
    { message: 'Minimum salary can’t be above the maximum', path: ['salaryMaxUsd'] },
  );

export type JobFormValues = z.infer<typeof jobFormSchema>;

export const emptyJobForm: JobFormValues = {
  title: '',
  companyName: '',
  url: '',
  city: '',
  countryCode: '',
  workplace: '',
  seniority: '',
  jobFunction: '',
  industry: '',
  skills: '',
  salaryMinUsd: '',
  salaryMaxUsd: '',
  description: '',
  applicationStatus: 'SAVED',
};

/** Form strings → API input. Empty fields are left out rather than sent as "". */
export function toCreateJobInput(values: JobFormValues): CreateJobInput {
  const input: CreateJobInput = {
    title: values.title.trim(),
    companyName: values.companyName.trim(),
    applicationStatus: values.applicationStatus,
  };
  const text = (value: string) => value.trim() || undefined;
  const optional: { [K in keyof CreateJobInput]?: CreateJobInput[K] | undefined } = {
    url: text(values.url),
    city: text(values.city),
    countryCode: text(values.countryCode)?.toUpperCase(),
    seniority: text(values.seniority),
    jobFunction: text(values.jobFunction),
    industry: text(values.industry),
    description: text(values.description),
    workplace: values.workplace === '' ? undefined : values.workplace,
    salaryMinUsd: values.salaryMinUsd === '' ? undefined : Number(values.salaryMinUsd),
    salaryMaxUsd: values.salaryMaxUsd === '' ? undefined : Number(values.salaryMaxUsd),
  };
  const skills = splitList(values.skills);
  if (skills.length) input.skills = skills;
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) Object.assign(input, { [key]: value });
  }
  return input;
}

const positiveInt = (max: number) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= max, {
      message: `Enter a whole number from 1 to ${max}`,
    });

export const syncFormSchema = z.object({
  titles: z.string().refine((v) => splitList(v).length > 0, 'Enter at least one job title'),
  skills: z.string(),
  countryCodes: z
    .string()
    .refine(
      (v) => splitList(v).every((c) => /^[A-Za-z]{2}$/.test(c)),
      'Use 2-letter codes, like US, DE',
    ),
  maxAgeDays: positiveInt(90),
  pageSize: positiveInt(100),
  maxPages: positiveInt(20),
});

export type SyncFormValues = z.infer<typeof syncFormSchema>;

export const defaultSyncForm: SyncFormValues = {
  titles: 'frontend',
  skills: 'react',
  countryCodes: '',
  maxAgeDays: '7',
  pageSize: '25',
  maxPages: '1',
};

export function toSyncJobsInput(values: SyncFormValues): SyncJobsInput {
  const skills = splitList(values.skills);
  const countryCodes = splitList(values.countryCodes).map((c) => c.toUpperCase());
  return {
    titles: splitList(values.titles),
    ...(skills.length ? { skills } : {}),
    ...(countryCodes.length ? { countryCodes } : {}),
    maxAgeDays: Number(values.maxAgeDays),
    pageSize: Number(values.pageSize),
    maxPages: Number(values.maxPages),
  };
}
