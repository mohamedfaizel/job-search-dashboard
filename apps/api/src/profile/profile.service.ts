import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error';
import type { LanguageResume, Profile } from '../generated/prisma/client';
import { FitService } from '../insights/fit.service';
import { PrismaService } from '../prisma/prisma.service';
import { customFieldsOf } from './custom-fields';
import type { LanguageResumeModel, ProfileInput, ProfileModel } from './profile.model';
import { buildMasterReviewPrompt, reviewResume } from './resume-review';
import { cleanResume } from './resume-text';
import { buildTranslationPrompt, languageName, RESUME_LANGUAGES } from './resumes';

/** What a user who never saved a profile sees (they may still have saved other resumes). */
const empty = (otherResumes: LanguageResumeModel[]): ProfileModel => ({
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  nationality: '',
  headline: '',
  targetRoles: [],
  locations: [],
  skills: [],
  keywords: [],
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
  employmentType: '',
  workplacePreference: '',
  drivingLicence: '',
  applicationNotes: '',
  achievements: '',
  resumeMaxPages: 2,
  keepMySections: false,
  notifyNewMatches: true,
  fillSavedAnswers: true,
  showStretches: true,
  matchFitMin: 60,
  resumeSuggestions: [],
  resumeReviewPrompt: '',
  customFields: [],
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
  const review = {
    text: profile.resumeText,
    languages: profile.languages,
    workPermit: profile.workPermit,
    achievements: profile.achievements,
    maxPages: profile.resumeMaxPages,
  };
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    nationality: profile.nationality,
    headline: profile.headline,
    targetRoles: profile.targetRoles,
    locations: profile.locations,
    skills: profile.skills,
    keywords: profile.keywords,
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
    employmentType: profile.employmentType,
    workplacePreference: profile.workplacePreference,
    drivingLicence: profile.drivingLicence,
    applicationNotes: profile.applicationNotes,
    achievements: profile.achievements,
    resumeMaxPages: profile.resumeMaxPages,
    keepMySections: profile.keepMySections,
    notifyNewMatches: profile.notifyNewMatches,
    fillSavedAnswers: profile.fillSavedAnswers,
    showStretches: profile.showStretches,
    matchFitMin: profile.matchFitMin,
    resumeSuggestions: reviewResume(review),
    resumeReviewPrompt: profile.resumeText.trim() ? buildMasterReviewPrompt(review) : '',
    customFields: customFieldsOf(profile.customFields),
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
      firstName: input.firstName,
      lastName: input.lastName,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      nationality: input.nationality,
      headline: input.headline,
      targetRoles: input.targetRoles,
      locations: input.locations,
      skills: input.skills,
      keywords: input.keywords,
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
      employmentType: input.employmentType,
      workplacePreference: input.workplacePreference,
      drivingLicence: input.drivingLicence,
      applicationNotes: input.applicationNotes,
      achievements: input.achievements,
      resumeMaxPages: input.resumeMaxPages,
      keepMySections: input.keepMySections,
      notifyNewMatches: input.notifyNewMatches,
      fillSavedAnswers: input.fillSavedAnswers,
      showStretches: input.showStretches,
      matchFitMin: input.matchFitMin,
      // Empty rows from the form are dropped.
      customFields: input.customFields
        .filter((f) => f.label || f.value)
        .map((f) => ({ label: f.label, value: f.value })),
    };
    // Your account name follows your first and last name, so resumes and letters use it.
    const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ');
    if (fullName) {
      await this.prisma.user.update({ where: { id: userId }, data: { name: fullName } });
    }
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
      throw apiError(
        BadRequestException,
        'LANGUAGE_IS_MASTER',
        `Your master resume is already in ${languageName(language)}. Pick another language.`,
        { language: language },
      );
    }
    const clean = cleanResume(text);
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
      throw apiError(NotFoundException, 'MASTER_RESUME_FIRST', 'Add your master resume first');
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
      throw apiError(BadRequestException, 'LANGUAGE_UNKNOWN', 'Pick a language from the list');
    }
  }
}
