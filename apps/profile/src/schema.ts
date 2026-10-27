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

/** The form works with strings (that's what inputs hold); toProfileInput converts them. */
export const profileSchema = z.object({
  headline: z.string().trim().max(160, 'Keep the headline under 160 characters'),
  targetRoles: list(20, 'roles'),
  locations: list(20, 'locations'),
  skills: list(60, 'skills'),
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
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export function profileToForm(profile: Profile): ProfileFormValues {
  return {
    headline: profile.headline,
    targetRoles: profile.targetRoles.join(', '),
    locations: profile.locations.join(', '),
    skills: profile.skills.join(', '),
    yearsExperience: profile.yearsExperience === null ? '' : String(profile.yearsExperience),
    linkedinUrl: profile.linkedinUrl ?? '',
    githubUrl: profile.githubUrl ?? '',
    websiteUrl: profile.websiteUrl ?? '',
    resumeText: profile.resumeText,
  };
}

export function toProfileInput(values: ProfileFormValues): ProfileInput {
  const orNull = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    headline: values.headline,
    targetRoles: splitList(values.targetRoles),
    locations: splitList(values.locations),
    skills: splitList(values.skills),
    yearsExperience: values.yearsExperience === '' ? null : Number(values.yearsExperience),
    linkedinUrl: orNull(values.linkedinUrl),
    githubUrl: orNull(values.githubUrl),
    websiteUrl: orNull(values.websiteUrl),
    resumeText: values.resumeText,
  };
}
