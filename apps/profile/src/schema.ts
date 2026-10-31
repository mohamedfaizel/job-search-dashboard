import type { Profile, ProfileInput } from '@jobsearch/data';
import { z } from 'zod';

/** Splits "react, node.js ,  " into ["react", "node.js"]. */
export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** A comma-separated box, with the same limits the API checks. */
const list = (max: number, name: string) =>
  z
    .string()
    .refine((v) => splitList(v).length <= max, { message: `Add at most ${max} ${name}` })
    .refine((v) => splitList(v).every((item) => item.length <= 80), {
      message: 'Keep each entry under 80 characters',
    });

const link = (site: string) =>
  z.union([
    z.literal(''),
    z.url({ protocol: /^https?$/, message: `${site} must be a full link (https://…)` }),
  ]);

const text = (max: number, name: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep ${name} under ${max.toLocaleString('en-US')} characters`);

/** The form works with strings (that's what inputs hold); toProfileInput converts them. */
export const profileSchema = z.object({
  firstName: text(80, 'the first name'),
  lastName: text(80, 'the last name'),
  gender: z.enum(['', 'female', 'male', 'diverse', 'not_specified']),
  dateOfBirth: z
    .string()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a date like 1990-05-31'),
  nationality: text(80, 'nationality'),
  headline: z.string().trim().max(160, 'Keep the headline under 160 characters'),
  targetRoles: list(20, 'roles'),
  locations: list(20, 'locations'),
  skills: list(60, 'skills'),
  languages: list(10, 'languages'),
  yearsExperience: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 60), {
      message: 'Years of experience must be between 0 and 60',
    }),
  linkedinUrl: link('LinkedIn'),
  githubUrl: link('GitHub'),
  websiteUrl: link('Website'),
  resumeText: z.string().max(50_000, 'Keep the resume under 50,000 characters'),
  resumeLanguage: z.string(),
  phone: text(40, 'the phone number'),
  address: text(200, 'the address'),
  workPermit: text(200, 'the work permit'),
  noticePeriod: text(100, 'the notice period'),
  salaryExpectation: text(100, 'the salary expectation'),
  relocation: text(200, 'the relocation answer'),
  employmentType: text(100, 'the employment type'),
  workplacePreference: text(100, 'the workplace preference'),
  drivingLicence: text(100, 'the driving licence'),
  applicationNotes: text(5_000, 'your saved answers'),
  customFields: z
    .array(
      z
        .object({
          label: text(60, 'each field name'),
          value: text(500, 'each field value'),
        })
        // A value with no name can't be read back later, on forms or in the Apply kit.
        .refine((f) => f.label.trim() !== '' || f.value.trim() === '', {
          message: 'Give the field a name',
          path: ['label'],
        }),
    )
    .max(30, 'Add at most 30 fields of your own'),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

const GENDER_CODES = ['female', 'male', 'diverse', 'not_specified'] as const;
const genderOf = (code: string): ProfileFormValues['gender'] =>
  GENDER_CODES.find((g) => g === code) ?? '';

/**
 * The form's starting values. Before you save a first and last name, they are suggested from
 * your account name ("Ada King Lovelace" → "Ada King" + "Lovelace").
 */
export function profileToForm(profile: Profile, accountName = ''): ProfileFormValues {
  const words = accountName.trim().split(/\s+/).filter(Boolean);
  const suggest = !profile.firstName && !profile.lastName && words.length > 0;
  return {
    firstName: suggest
      ? words.slice(0, Math.max(1, words.length - 1)).join(' ')
      : profile.firstName,
    lastName: suggest ? (words.length > 1 ? (words.at(-1) ?? '') : '') : profile.lastName,
    gender: genderOf(profile.gender),
    dateOfBirth: profile.dateOfBirth,
    nationality: profile.nationality,
    headline: profile.headline,
    targetRoles: profile.targetRoles.join(', '),
    locations: profile.locations.join(', '),
    skills: profile.skills.join(', '),
    languages: profile.languages.join(', '),
    yearsExperience: profile.yearsExperience === null ? '' : String(profile.yearsExperience),
    linkedinUrl: profile.linkedinUrl ?? '',
    githubUrl: profile.githubUrl ?? '',
    websiteUrl: profile.websiteUrl ?? '',
    resumeText: profile.resumeText,
    resumeLanguage: profile.resumeLanguage,
    phone: profile.phone,
    address: profile.address,
    workPermit: profile.workPermit,
    noticePeriod: profile.noticePeriod,
    salaryExpectation: profile.salaryExpectation,
    relocation: profile.relocation,
    employmentType: profile.employmentType,
    workplacePreference: profile.workplacePreference,
    drivingLicence: profile.drivingLicence,
    applicationNotes: profile.applicationNotes,
    customFields: profile.customFields.map((f) => ({ label: f.label, value: f.value })),
  };
}

export function toProfileInput(values: ProfileFormValues): ProfileInput {
  const orNull = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    gender: values.gender,
    dateOfBirth: values.dateOfBirth,
    nationality: values.nationality,
    headline: values.headline,
    targetRoles: splitList(values.targetRoles),
    locations: splitList(values.locations),
    skills: splitList(values.skills),
    languages: splitList(values.languages),
    yearsExperience: values.yearsExperience === '' ? null : Number(values.yearsExperience),
    linkedinUrl: orNull(values.linkedinUrl),
    githubUrl: orNull(values.githubUrl),
    websiteUrl: orNull(values.websiteUrl),
    resumeText: values.resumeText,
    resumeLanguage: values.resumeLanguage,
    phone: values.phone,
    address: values.address,
    workPermit: values.workPermit,
    noticePeriod: values.noticePeriod,
    salaryExpectation: values.salaryExpectation,
    relocation: values.relocation,
    employmentType: values.employmentType,
    workplacePreference: values.workplacePreference,
    drivingLicence: values.drivingLicence,
    applicationNotes: values.applicationNotes,
    // Rows left empty are dropped.
    customFields: values.customFields.filter((f) => f.label.trim() || f.value.trim()),
  };
}
