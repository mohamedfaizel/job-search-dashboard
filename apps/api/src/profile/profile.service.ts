import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { LanguageResume, Profile } from '../generated/prisma/client';
import { FitService } from '../insights/fit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { LanguageResumeModel, ProfileInput, ProfileModel } from './profile.model';
import { tidy } from './resume-text';
import { buildTranslationPrompt, languageName, RESUME_LANGUAGES } from './resumes';

/** Longer than any real resume, short enough to keep junk out. */
const MAX_RESUME_CHARS = 50_000;

/** What a user who never saved a profile sees (they may still have saved other resumes). */
const empty = (otherResumes: LanguageResumeModel[]): ProfileModel => ({
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
  resumeLanguage: 'en',
  otherResumes,
  phone: '',
  address: '',
  workPermit: '',
  noticePeriod: '',
  salaryExpectation: '',
  relocation: '',
  applicationNotes: '',
  updatedAt: null,
});

/** The file bytes can be 5 MB, so normal reads leave them out. */
const WITHOUT_FILE = { resumeFile: true } as const;

type OtherResume = Pick<LanguageResume, 'language' | 'text' | 'fileName' | 'updatedAt'>;
const OTHER_RESUME = { language: true, text: true, fileName: true, updatedAt: true } as const;

function toModel(
  profile: Omit<Profile, 'resumeFile'> | null,
  others: OtherResume[] = [],
): ProfileModel {
  const otherResumes: LanguageResumeModel[] = others.map((r) => ({
    language: r.language,
    text: r.text,
    fileName: r.fileName,
    updatedAt: r.updatedAt,
  }));
  if (!profile) return empty(otherResumes);
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
    resumeLanguage: profile.resumeLanguage,
    otherResumes,
    phone: profile.phone,
    address: profile.address,
    workPermit: profile.workPermit,
    noticePeriod: profile.noticePeriod,
    salaryExpectation: profile.salaryExpectation,
    relocation: profile.relocation,
    applicationNotes: profile.applicationNotes,
    updatedAt: profile.updatedAt,
  };
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fit: FitService,
  ) {}

  async get(userId: number): Promise<ProfileModel> {
    const [profile, others] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, omit: WITHOUT_FILE }),
      this.others(userId),
    ]);
    return toModel(profile, others);
  }

  private others(userId: number): Promise<OtherResume[]> {
    return this.prisma.languageResume.findMany({
      where: { userId },
      select: OTHER_RESUME,
      orderBy: { language: 'asc' },
    });
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
      ...(input.resumeLanguage ? { resumeLanguage: input.resumeLanguage } : {}),
      phone: input.phone,
      address: input.address,
      workPermit: input.workPermit,
      noticePeriod: input.noticePeriod,
      salaryExpectation: input.salaryExpectation,
      relocation: input.relocation,
      applicationNotes: input.applicationNotes,
    };
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      omit: WITHOUT_FILE,
    });
    // Your Fit % for every job starts again now, so the table is ready when you open it.
    this.fit.warm(userId);
    return toModel(profile, await this.others(userId));
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
    // Your Fit % for every job starts again now, so the table is ready when you open it.
    this.fit.warm(userId);
    return toModel(profile, await this.others(userId));
  }

  /**
   * Saves your master resume in another language (pasted text, or read from an uploaded file),
   * replacing the one before. Jobs in that language are scored and prompted against it.
   */
  async saveLanguageResume(
    userId: number,
    language: string,
    text: string,
    file?: { name: string; type: string; bytes: Buffer },
  ): Promise<ProfileModel> {
    this.assertLanguage(language);
    const main = await this.prisma.profile.findUnique({
      where: { userId },
      select: { resumeLanguage: true },
    });
    if ((main?.resumeLanguage ?? 'en') === language) {
      throw new BadRequestException(
        `Your master resume is already in ${languageName(language)}. Pick another language.`,
      );
    }
    const clean = tidy(text);
    if (!clean) throw new BadRequestException('The resume is empty');
    if (clean.length > MAX_RESUME_CHARS) {
      throw new BadRequestException(`A resume is at most ${String(MAX_RESUME_CHARS)} characters`);
    }
    const data = {
      text: clean,
      fileName: file?.name ?? null,
      file: file ? new Uint8Array(file.bytes) : null,
      fileType: file?.type ?? null,
    };
    await this.prisma.languageResume.upsert({
      where: { userId_language: { userId, language } },
      create: { userId, language, ...data },
      update: data,
    });
    this.fit.warm(userId);
    return this.get(userId);
  }

  /** Deletes your resume in a language. Deleting again does nothing. */
  async deleteLanguageResume(userId: number, language: string): Promise<ProfileModel> {
    await this.prisma.languageResume.deleteMany({ where: { userId, language } });
    this.fit.warm(userId);
    return this.get(userId);
  }

  /** A Claude prompt that translates your master resume into `language`, keeping every fact. */
  async translationPrompt(userId: number, language: string): Promise<string> {
    this.assertLanguage(language);
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { resumeText: true, resumeLanguage: true, languages: true },
    });
    if (!profile?.resumeText.trim()) {
      throw new NotFoundException('Add your master resume first');
    }
    return buildTranslationPrompt({
      resume: profile.resumeText,
      from: profile.resumeLanguage,
      to: language,
      languages: profile.languages,
    });
  }

  private assertLanguage(language: string) {
    if (!(language in RESUME_LANGUAGES)) {
      throw new BadRequestException('Pick a language from the list');
    }
  }
}
