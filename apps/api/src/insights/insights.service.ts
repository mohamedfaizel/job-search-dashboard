import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { customFieldsOf } from '../profile/custom-fields';
import { tidy } from '../profile/resume-text';
import type { MasterResumes } from '../profile/resumes';
import { resumeFor } from '../profile/resumes';
import { buildApplyKit } from './apply-kit';
import type { ApplyQueueItemModel, ApplyQueuePromptModel } from './apply-queue';
import { buildQueuePage } from './apply-queue';
import { CorpusService } from './corpus.service';
import { germanRequirement } from './german';
import type {
  JobInsightsModel,
  JobResumeModel,
  RemovedTermModel,
  TermCheckModel,
} from './insights.model';
import type { PromptInput } from './prompt';
import {
  applicationFacts,
  buildQueuePrompt,
  buildResumePrompt,
  QUEUE_PROMPT_MAX,
  splitQueueReply,
  splitReply,
} from './prompt';
import type { ResumeCheck } from './score';
import { checkResume } from './score';
import { relatedTo } from './skills';
import { jobTerms } from './terms';

/** Longer than any real resume, short enough to keep junk out. */
export const MAX_RESUME_CHARS = 50_000;

/** A resume file: what was uploaded, or what a download sends. */
export interface JobResumeFile {
  name: string;
  type: string;
  bytes: Buffer;
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corpora: CorpusService,
  ) {}

  async forJob(userId: number, jobId: string): Promise<JobInsightsModel> {
    return (await this.analyse(userId, jobId)).insights;
  }

  /** The job's insights, and what its Apply kit prompt is built from. */
  private async analyse(
    userId: number,
    jobId: string,
  ): Promise<{ insights: JobInsightsModel; promptInput: PromptInput }> {
    const [job, profile, removedRows, jobResume, languageResumes] = await Promise.all([
      this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          title: true,
          description: true,
          language: true,
          skills: true,
          city: true,
          raw: true,
          company: { select: { name: true } },
        },
      }),
      this.prisma.profile.findUnique({
        where: { userId },
        select: {
          resumeText: true,
          resumeLanguage: true,
          skills: true,
          languages: true,
          yearsExperience: true,
          address: true,
          workPermit: true,
          noticePeriod: true,
          salaryExpectation: true,
          relocation: true,
          applicationNotes: true,
        },
      }),
      this.prisma.removedTerm.findMany({
        where: { userId, OR: [{ jobId }, { jobId: null }] },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.jobResume.findUnique({
        where: { userId_jobId: { userId, jobId } },
        select: {
          text: true,
          fileName: true,
          coverLetter: true,
          formAnswers: true,
          updatedAt: true,
        },
      }),
      this.prisma.languageResume.findMany({
        where: { userId },
        select: { language: true, text: true },
      }),
    ]);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const resumes: MasterResumes = {
      language: profile?.resumeLanguage ?? 'en',
      text: profile?.resumeText ?? '',
      others: new Map(languageResumes.map((r) => [r.language, r.text])),
    };
    const otherSkills = profile?.skills ?? [];

    // Terms you removed with × leave both lists. One removed everywhere wins over this job's.
    const removed = new Map<string, RemovedTermModel>();
    for (const row of removedRows) {
      const everywhere = row.jobId === null || removed.get(row.term)?.everywhere === true;
      removed.set(row.term, { term: row.term, everywhere });
    }

    const { normalizedTitle, ...terms } = jobTerms(
      job,
      new Set(removed.keys()),
      await this.corpora.corpus(),
    );
    const language = terms.language;
    const german = germanRequirement(job.description, language);
    const resumeLanguage = german.required ? 'de' : 'en';
    // The ad is checked against your resume in its own language when you have one, so German
    // words in a German ad can be found. Claude starts from the resume in the language to write.
    const scored = resumeFor(resumes, language);
    const forPrompt = resumeFor(resumes, resumeLanguage);
    const resume = scored.text;
    const before = checkResume(resume, terms, otherSkills);
    // A missing term next to a skill you have ("apollo" with "graphql") gets a hint.
    const yourSkills = [resume, ...otherSkills].join('\n');
    const withHint = (checks: TermCheckModel[]) =>
      checks.map(({ term, inResume, youHave }) => ({
        term,
        inResume,
        youHave,
        relatedTo: inResume || youHave ? null : relatedTo(term, yourSkills),
      }));
    const hasResume = resume.trim().length > 0;
    const missing = (checks: TermCheckModel[]) =>
      checks.filter((t) => !t.youHave && (!hasResume || !t.inResume)).map((t) => t.term);

    const promptInput: PromptInput = {
      title: job.title,
      company: job.company.name,
      city: job.city,
      resumeLanguage,
      germanLevel: german.level,
      languages: profile?.languages ?? [],
      missingSkills: missing(before.skillChecks),
      missingKeywords: missing(before.keywordChecks),
      mustAdd: [...before.skillChecks, ...before.keywordChecks]
        .filter((t) => t.youHave)
        .map((t) => t.term),
      otherSkills,
      resume: forPrompt.text,
      resumeIn: forPrompt.language,
      description: job.description,
      facts: applicationFacts(profile),
      savedAnswers: profile?.applicationNotes ?? '',
    };
    const insights: JobInsightsModel = {
      jobId,
      title: job.title,
      normalizedTitle,
      language,
      languageDetected: !job.language && !!language,
      germanRequired: german.required,
      germanLevel: german.level,
      resumeLanguage,
      checkedAgainst: scored.language,
      hasResume,
      skills: withHint(before.skillChecks),
      keywords: withHint(before.keywordChecks),
      removed: [...removed.values()],
      skillsCoverage: before.skills,
      keywordsCoverage: before.keywords,
      titleMatch: before.title,
      score: before.score,
      jobResume: jobResume && this.afterScore(jobResume, terms, before),
      prompt: buildResumePrompt(promptInput),
    };
    return { insights, promptInput };
  }

  /**
   * Removes a skill or keyword from a job's insights: from this job only, or from every job.
   * Removing it again does nothing.
   */
  async removeTerm(userId: number, jobId: string, term: string, everywhere: boolean) {
    const clean = term.trim().toLowerCase();
    if (!clean || clean.length > 100)
      throw new BadRequestException('A term is 1 to 100 characters');
    const scope = everywhere ? null : jobId;
    await this.assertJob(jobId);
    const existing = await this.prisma.removedTerm.findFirst({
      where: { userId, jobId: scope, term: clean },
    });
    if (!existing) {
      await this.prisma.removedTerm.create({ data: { userId, jobId: scope, term: clean } });
    }
    return this.forJob(userId, jobId);
  }

  /**
   * "I have this": adds a missing skill or keyword to the Skills list of My profile, so it counts
   * as covered in every job's score and the prompt tells Claude to put it in the resume.
   * `have: false` takes it off the list again. Saving it twice keeps one.
   */
  async setHaveTerm(userId: number, jobId: string, term: string, have: boolean) {
    const clean = term.trim();
    if (!clean || clean.length > 100)
      throw new BadRequestException('A term is 1 to 100 characters');
    await this.assertJob(jobId);
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { skills: true },
    });
    const skills = profile?.skills ?? [];
    const same = (skill: string) => skill.trim().toLowerCase() === clean.toLowerCase();
    const next = have
      ? skills.some(same)
        ? skills
        : [...skills, clean]
      : skills.filter((skill) => !same(skill));
    if (next !== skills) {
      await this.prisma.profile.upsert({
        where: { userId },
        create: { userId, skills: next },
        update: { skills: next },
      });
    }
    return this.forJob(userId, jobId);
  }

  /** Puts a removed term back, both for this job and everywhere. */
  async restoreTerm(userId: number, jobId: string, term: string) {
    await this.prisma.removedTerm.deleteMany({
      where: { userId, term: term.trim().toLowerCase(), OR: [{ jobId }, { jobId: null }] },
    });
    return this.forJob(userId, jobId);
  }

  /**
   * Saves the resume you wrote for a job, replacing the one before. Pasted text comes without a
   * file; an upload keeps its file so it can be downloaded again.
   */
  async saveJobResume(userId: number, jobId: string, text: string, file?: JobResumeFile) {
    // An Apply kit reply has the cover letter and form answers after the resume: keep them apart,
    // so only the resume is scored and downloaded.
    const reply = splitReply(text);
    const clean = tidy(reply.resume);
    if (!clean) throw new BadRequestException('The resume is empty');
    if (clean.length > MAX_RESUME_CHARS) {
      throw new BadRequestException(`A resume is at most ${String(MAX_RESUME_CHARS)} characters`);
    }
    await this.assertJob(jobId);
    const data = {
      text: clean,
      fileName: file?.name ?? null,
      file: file ? new Uint8Array(file.bytes) : null,
      fileType: file?.type ?? null,
      coverLetter: reply.coverLetter,
      formAnswers: reply.formAnswers,
    };
    await this.prisma.jobResume.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId, ...data },
      update: data,
    });
    return this.forJob(userId, jobId);
  }

  /** Deletes the resume you wrote for a job. Deleting again does nothing. */
  async deleteJobResume(userId: number, jobId: string) {
    await this.prisma.jobResume.deleteMany({ where: { userId, jobId } });
    return this.forJob(userId, jobId);
  }

  /** The resume you wrote for a job, as a file: the uploaded one, or the pasted text as .txt. */
  async jobResumeFile(userId: number, jobId: string): Promise<JobResumeFile> {
    const row = await this.prisma.jobResume.findUnique({
      where: { userId_jobId: { userId, jobId } },
      select: { text: true, fileName: true, file: true, fileType: true },
    });
    if (!row) throw new NotFoundException('No resume saved for this job');
    if (row.file && row.fileName) {
      return {
        name: row.fileName,
        type: row.fileType ?? 'application/octet-stream',
        bytes: Buffer.from(row.file),
      };
    }
    return {
      name: 'resume.txt',
      type: 'text/plain; charset=utf-8',
      bytes: Buffer.from(row.text, 'utf8'),
    };
  }

  /** The Apply kit page for one job: your details, the form answers, cover letter and resume. */
  async applyKit(userId: number, jobId: string, resumeUrl: string): Promise<string> {
    const [job, user, jobResume] = await Promise.all([
      this.prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, url: true, company: { select: { name: true } } },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, email: true, profile: { omit: { resumeFile: true } } },
      }),
      this.prisma.jobResume.findUnique({
        where: { userId_jobId: { userId, jobId } },
        select: { text: true, coverLetter: true, formAnswers: true },
      }),
    ]);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    const p = user.profile;
    return buildApplyKit({
      job: { title: job.title, company: job.company.name, url: job.url },
      me: {
        name: user.name,
        firstName: p?.firstName ?? '',
        lastName: p?.lastName ?? '',
        gender: p?.gender ?? '',
        dateOfBirth: p?.dateOfBirth ?? '',
        nationality: p?.nationality ?? '',
        email: user.email,
        phone: p?.phone ?? '',
        address: p?.address ?? '',
        linkedinUrl: p?.linkedinUrl ?? null,
        githubUrl: p?.githubUrl ?? null,
        websiteUrl: p?.websiteUrl ?? null,
        yearsExperience: p?.yearsExperience ?? null,
        languages: p?.languages ?? [],
        workPermit: p?.workPermit ?? '',
        noticePeriod: p?.noticePeriod ?? '',
        salaryExpectation: p?.salaryExpectation ?? '',
        relocation: p?.relocation ?? '',
        employmentType: p?.employmentType ?? '',
        workplacePreference: p?.workplacePreference ?? '',
        drivingLicence: p?.drivingLicence ?? '',
        applicationNotes: p?.applicationNotes ?? '',
        customFields: customFieldsOf(p?.customFields),
      },
      jobResume,
      resumeUrl,
    });
  }

  /** Your Apply queue, oldest first. */
  async applyQueue(userId: number): Promise<ApplyQueueItemModel[]> {
    const rows = await this.prisma.applyQueueItem.findMany({
      where: { userId },
      orderBy: { addedAt: 'asc' },
      select: {
        addedAt: true,
        job: {
          select: {
            id: true,
            title: true,
            url: true,
            company: { select: { name: true } },
            jobResumes: { where: { userId }, select: { coverLetter: true, formAnswers: true } },
          },
        },
      },
    });
    return rows.map(({ addedAt, job }) => {
      const reply = job.jobResumes[0];
      return {
        jobId: job.id,
        title: job.title,
        company: job.company.name,
        url: job.url,
        ready: !!reply && (reply.coverLetter !== '' || reply.formAnswers !== ''),
        addedAt,
      };
    });
  }

  /** Adds jobs to your Apply queue. Jobs already in it keep their place. */
  async addToApplyQueue(userId: number, jobIds: string[]): Promise<ApplyQueueItemModel[]> {
    const jobs = await this.prisma.job.findMany({
      where: { id: { in: jobIds } },
      select: { id: true },
    });
    await this.prisma.applyQueueItem.createMany({
      data: jobs.map((job) => ({ userId, jobId: job.id })),
      skipDuplicates: true,
    });
    return this.applyQueue(userId);
  }

  async removeFromApplyQueue(userId: number, jobIds: string[]): Promise<ApplyQueueItemModel[]> {
    await this.prisma.applyQueueItem.deleteMany({ where: { userId, jobId: { in: jobIds } } });
    return this.applyQueue(userId);
  }

  /**
   * One Claude prompt for the queued jobs that have no reply yet (the oldest few), so a single
   * chat writes all their resumes, cover letters and form answers.
   */
  async applyQueuePrompt(userId: number): Promise<ApplyQueuePromptModel> {
    const waiting = (await this.applyQueue(userId)).filter((item) => !item.ready);
    const jobIds = waiting.slice(0, QUEUE_PROMPT_MAX).map((item) => item.jobId);
    const inputs = await Promise.all(
      jobIds.map(async (jobId) => ({ jobId, ...(await this.analyse(userId, jobId)).promptInput })),
    );
    return { prompt: buildQueuePrompt(inputs), jobIds, waiting: waiting.length };
  }

  /**
   * Saves Claude's reply to the queue prompt: each job's part goes to that job, as if pasted in
   * its own Apply kit. Returns the queue, now with those jobs ready.
   */
  async saveApplyQueueReply(userId: number, text: string): Promise<ApplyQueueItemModel[]> {
    const queued = (await this.applyQueue(userId)).map((item) => item.jobId);
    const replies = splitQueueReply(text, queued);
    if (replies.size === 0) {
      throw new BadRequestException(
        'No "=== JOB 1: … ===" lines found. Paste Claude’s whole reply to the queue prompt.',
      );
    }
    for (const [jobId, reply] of replies) await this.saveJobResume(userId, jobId, reply);
    return this.applyQueue(userId);
  }

  /** The queue page for Claude in Chrome. `kitUrl` makes each job's Apply kit link. */
  async applyQueuePage(userId: number, kitUrl: (jobId: string) => string): Promise<string> {
    const items = await this.applyQueue(userId);
    return buildQueuePage(
      items.map(({ jobId, title, company, url, ready }) => ({
        title,
        company,
        url,
        ready,
        kitUrl: kitUrl(jobId),
      })),
    );
  }

  private async assertJob(jobId: string) {
    if (!(await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } }))) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
  }

  /** Scores the resume you wrote for the job, and what changed from your profile resume. */
  private afterScore(
    jobResume: {
      text: string;
      fileName: string | null;
      coverLetter: string;
      formAnswers: string;
      updatedAt: Date;
    },
    terms: Parameters<typeof checkResume>[1],
    before: ResumeCheck,
  ): JobResumeModel {
    const after = checkResume(jobResume.text, terms);
    const beforeChecks = [...before.skillChecks, ...before.keywordChecks];
    const afterChecks = [...after.skillChecks, ...after.keywordChecks];
    return {
      fileName: jobResume.fileName,
      coverLetter: jobResume.coverLetter,
      formAnswers: jobResume.formAnswers,
      updatedAt: jobResume.updatedAt,
      skillsCoverage: after.skills,
      keywordsCoverage: after.keywords,
      titleMatch: after.title,
      score: after.score,
      nowCovered: afterChecks
        .filter((t, i) => t.inResume && !beforeChecks[i]?.inResume)
        .map((t) => t.term),
      stillMissing: afterChecks.filter((t) => !t.inResume).map((t) => t.term),
    };
  }
}
