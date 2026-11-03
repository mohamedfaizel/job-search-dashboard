import type { CreateJobInput, SavedSearch, SavedSearchInput, SyncJobsInput } from '@jobsearch/data';
import {
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPES,
  IMPORT_SOURCES,
  WORKPLACES,
} from '@jobsearch/data';
import { z } from 'zod';
import { splitList } from '@/lib/split-list';

/** Splits "greenhouse:stripe, lever:netflix  ashby:ramp" on commas and spaces. */
function splitBoards(value: string): string[] {
  return value.split(/[\s,]+/).filter(Boolean);
}

/** Turns an error key from messages/<locale>.json ("AddJobs.errors") into text. */
export type ErrorText = (key: string, values?: Record<string, string | number>) => string;

export const SENIORITIES = ['intern', 'junior', 'mid', 'senior', 'lead', 'director', 'executive'];

/**
 * Validation rules for the add-job form, with error messages in your language. The form works
 * with strings (that's what inputs hold); toCreateJobInput converts them to the API's types.
 */
export function jobFormSchema(t: ErrorText) {
  const optionalText = (max: number) => z.string().trim().max(max, t('tooLong', { max }));
  const salary = z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 10_000_000), {
      message: t('salary'),
    });
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(1, t('titleRequired'))
        .max(300, t('tooLong', { max: 300 })),
      companyName: z
        .string()
        .trim()
        .min(1, t('companyRequired'))
        .max(200, t('tooLong', { max: 200 })),
      url: z.union([z.literal(''), z.url({ message: t('url') })]),
      city: optionalText(100),
      countryCode: z
        .string()
        .trim()
        .refine((v) => v === '' || /^[A-Za-z]{2}$/.test(v), {
          message: t('countryCode'),
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
      { message: t('salaryOrder'), path: ['salaryMaxUsd'] },
    );
}

export type JobFormValues = z.infer<ReturnType<typeof jobFormSchema>>;

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

/** The import form's rules, with error messages in your language. */
export function syncFormSchema(t: ErrorText) {
  const positiveInt = (max: number) =>
    z
      .string()
      .trim()
      .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= max, {
        message: t('wholeNumber', { max }),
      });
  const fields = z.object({
    source: z.enum(IMPORT_SOURCES),
    boards: z.string(),
    titles: z.string().refine((v) => splitList(v).length > 0, t('titles')),
    skills: z.string(),
    countryCodes: z
      .string()
      .refine((v) => splitList(v).every((c) => /^[A-Za-z]{2}$/.test(c)), t('countryCodes')),
    locations: z.string(),
    languages: z.array(z.string()),
    skipFluentGerman: z.boolean(),
    remoteOnly: z.boolean(),
    excludeTitles: z.string(),
    employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)),
    minSalaryEur: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1_000_000), {
        message: t('minSalary'),
      }),
    maxAgeDays: positiveInt(90),
    // JobsPipe caps the page size by plan (Free 25, Builder/Growth 100, Scale/Business 500).
    pageSize: positiveInt(500),
    maxPages: positiveInt(50),
    onlyNew: z.boolean(),
  });
  // Career pages are only asked for when that source is picked.
  return fields.refine((v) => v.source !== 'COMPANY_BOARDS' || splitBoards(v.boards).length > 0, {
    path: ['boards'],
    message: t('boards'),
  });
}

export type SyncFormValues = z.infer<ReturnType<typeof syncFormSchema>>;

export const defaultSyncForm: SyncFormValues = {
  source: 'JOBSPIPE',
  boards: '',
  titles: 'frontend',
  skills: 'react',
  countryCodes: '',
  locations: '',
  languages: [],
  skipFluentGerman: false,
  remoteOnly: false,
  excludeTitles: '',
  employmentTypes: [],
  minSalaryEur: '',
  maxAgeDays: '7',
  pageSize: '25',
  maxPages: '1',
  onlyNew: true,
};

export function toSyncJobsInput(values: SyncFormValues): SyncJobsInput {
  const skills = splitList(values.skills);
  const countryCodes = splitList(values.countryCodes).map((c) => c.toUpperCase());
  const locations = splitList(values.locations);
  const excludeTitles = splitList(values.excludeTitles);
  const minSalary = values.minSalaryEur.trim();
  // The free sources look at titles, places, job type, remote, skipped titles and age.
  // Fields they ignore are left out, so a value hidden in the form is never sent.
  const free = values.source !== 'JOBSPIPE';
  const boards = splitBoards(values.boards);
  return {
    ...(free ? { source: values.source } : {}),
    ...(values.source === 'COMPANY_BOARDS' ? { boards } : {}),
    titles: splitList(values.titles),
    ...(skills.length && !free ? { skills } : {}),
    ...(countryCodes.length && !free ? { countryCodes } : {}),
    ...(locations.length ? { locations } : {}),
    ...(values.languages.length && !free ? { languages: values.languages } : {}),
    ...(values.skipFluentGerman && !free ? { skipFluentGerman: true } : {}),
    ...(values.remoteOnly ? { remoteOnly: true } : {}),
    ...(excludeTitles.length ? { excludeTitles } : {}),
    ...(values.employmentTypes.length ? { employmentTypes: values.employmentTypes } : {}),
    ...(minSalary && !free ? { minSalaryEur: Number(minSalary) } : {}),
    maxAgeDays: Number(values.maxAgeDays),
    pageSize: Number(values.pageSize),
    maxPages: Number(values.maxPages),
    onlyNew: values.onlyNew,
  };
}

/** A saved search → the import form, so it can be edited, run or saved again. */
export function savedSearchToForm(search: SavedSearch): SyncFormValues {
  return {
    source: search.source,
    boards: search.boards.join(', '),
    titles: search.titles.join(', '),
    skills: search.skills.join(', '),
    countryCodes: search.countryCodes.join(', '),
    locations: search.locations.join(', '),
    languages: search.languages,
    skipFluentGerman: search.skipFluentGerman,
    remoteOnly: search.remoteOnly,
    excludeTitles: search.excludeTitles.join(', '),
    employmentTypes: search.employmentTypes,
    minSalaryEur: search.minSalaryEur === null ? '' : String(search.minSalaryEur),
    maxAgeDays: String(search.maxAgeDays),
    pageSize: String(search.pageSize),
    maxPages: String(search.maxPages),
    onlyNew: search.onlyNew,
  };
}

export function toSavedSearchInput(name: string, values: SyncFormValues): SavedSearchInput {
  return { name: name.trim(), ...toSyncJobsInput(values) };
}
