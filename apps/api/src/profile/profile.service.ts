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
  yearsExperience: null,
  linkedinUrl: null,
  githubUrl: null,
  websiteUrl: null,
  resumeText: '',
  resumeFileName: null,
  updatedAt: null,
};

function toModel(profile: Profile | null): ProfileModel {
  if (!profile) return EMPTY;
  return {
    headline: profile.headline,
    targetRoles: profile.targetRoles,
    locations: profile.locations,
    skills: profile.skills,
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
    return toModel(await this.prisma.profile.findUnique({ where: { userId } }));
  }

  async update(userId: number, input: ProfileInput): Promise<ProfileModel> {
    const data = {
      headline: input.headline,
      targetRoles: input.targetRoles,
      locations: input.locations,
      skills: input.skills,
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
    });
    return toModel(profile);
  }

  /** Replaces the resume text with what was read from an uploaded file. */
  async saveResume(userId: number, fileName: string, resumeText: string): Promise<ProfileModel> {
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, resumeText, resumeFileName: fileName },
      update: { resumeText, resumeFileName: fileName },
    });
    return toModel(profile);
  }
}
