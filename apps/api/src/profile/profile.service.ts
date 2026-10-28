import { Injectable } from '@nestjs/common';
import type { Profile } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ProfileInput, ProfileModel } from './profile.model';

/** What a user who never saved a profile sees. */
const EMPTY: ProfileModel = {
  headline: '',
  targetRoles: [],
  locations: [],
  skills: [],
  languages: [],
  yearsExperience: null,
  linkedinUrl: null,
  githubUrl: null,
  websiteUrl: null,
  resumeText: '',
  resumeFileName: null,
  updatedAt: null,
};

/** The file bytes can be 5 MB, so normal reads leave them out. */
const WITHOUT_FILE = { resumeFile: true } as const;

function toModel(profile: Omit<Profile, 'resumeFile'> | null): ProfileModel {
  if (!profile) return EMPTY;
  return {
    headline: profile.headline,
    targetRoles: profile.targetRoles,
    locations: profile.locations,
    skills: profile.skills,
    languages: profile.languages,
    yearsExperience: profile.yearsExperience,
    linkedinUrl: profile.linkedinUrl,
    githubUrl: profile.githubUrl,
    websiteUrl: profile.websiteUrl,
    resumeText: profile.resumeText,
    resumeFileName: profile.resumeFileName,
    updatedAt: profile.updatedAt,
  };
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: number): Promise<ProfileModel> {
    return toModel(await this.prisma.profile.findUnique({ where: { userId }, omit: WITHOUT_FILE }));
  }

  async update(userId: number, input: ProfileInput): Promise<ProfileModel> {
    const data = {
      headline: input.headline,
      targetRoles: input.targetRoles,
      locations: input.locations,
      skills: input.skills,
      languages: input.languages,
      yearsExperience: input.yearsExperience ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      githubUrl: input.githubUrl ?? null,
      websiteUrl: input.websiteUrl ?? null,
      resumeText: input.resumeText,
    };
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      omit: WITHOUT_FILE,
    });
    return toModel(profile);
  }

  /**
   * Replaces the resume text with what was read from an uploaded file, and keeps the file
   * itself so Resume-Matcher can read the original layout.
   */
  async saveResume(
    userId: number,
    file: { name: string; type: string; bytes: Buffer },
    resumeText: string,
  ): Promise<ProfileModel> {
    const data = {
      resumeText,
      resumeFileName: file.name,
      resumeFile: new Uint8Array(file.bytes),
      resumeFileType: file.type,
      resumeUploadedAt: new Date(),
    };
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      omit: WITHOUT_FILE,
    });
    return toModel(profile);
  }
}
