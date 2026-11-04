import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { apiError } from '../common/api-error';
import { DocumentsService } from '../documents/documents.service';
import { JobMatchStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  describeError,
  describeRunError,
  ResumeMatcherClient,
} from '../resume-matcher/resume-matcher.client';

const INTERRUPTED_MESSAGE = 'The API restarted while this check was running. Check again.';
const NOT_READ_MESSAGE =
  "Resume-Matcher got the PDF, but its AI couldn't read it. Check the key with Test AI connection on My profile, then try again.";
const NO_SCORE_MESSAGE = "Resume-Matcher couldn't score this resume. Check again.";

/**
 * Scores the resume Claude wrote for a job with Resume-Matcher, the way "AI match" scores your
 * master resume. The saved resume is made into a PDF, sent over as a temporary resume, scored,
 * and deleted again (Resume-Matcher keeps at most 5 master resumes). It takes a minute or two,
 * so `start` returns at once and the page polls until the row is READY or FAILED.
 */
@Injectable()
export class ReplyMatchService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReplyMatchService.name);
  /** "userId:jobId" for every check running in this process. */
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ResumeMatcherClient,
    private readonly documents: DocumentsService,
  ) {}

  /** Background work dies with the process, so a PENDING row left from before can't finish. */
  async onApplicationBootstrap(): Promise<void> {
    await this.prisma.jobResume.updateMany({
      where: { aiStatus: JobMatchStatus.PENDING },
      data: { aiStatus: JobMatchStatus.FAILED, aiError: INTERRUPTED_MESSAGE },
    });
  }

  async start(userId: number, jobId: string): Promise<void> {
    const key = `${userId}:${jobId}`;
    if (this.running.has(key)) return;
    const [row, job] = await Promise.all([
      this.prisma.jobResume.findUnique({
        where: { userId_jobId: { userId, jobId } },
        select: { text: true },
      }),
      this.prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, description: true, company: { select: { name: true } } },
      }),
    ]);
    if (!row?.text.trim()) {
      throw apiError(
        BadRequestException,
        'JOB_RESUME_MISSING',
        'Save the Apply kit reply for this job first.',
      );
    }
    if (!job?.description?.trim()) {
      throw apiError(
        BadRequestException,
        'JOB_NO_DESCRIPTION',
        'This job has no description to compare your resume with.',
      );
    }
    const startedAt = new Date();
    await this.prisma.jobResume.update({
      where: { userId_jobId: { userId, jobId } },
      data: {
        aiStatus: JobMatchStatus.PENDING,
        aiScore: null,
        aiError: null,
        aiStartedAt: startedAt,
      },
    });
    this.running.add(key);
    // Not awaited on purpose: the request returns now and the page polls for the result.
    void this.run(
      userId,
      jobId,
      `${job.title} at ${job.company.name}\n\n${job.description}`,
      startedAt,
    ).finally(() => this.running.delete(key));
  }

  /** Never throws: every outcome, good or bad, ends up on the row. */
  private async run(
    userId: number,
    jobId: string,
    description: string,
    startedAt: Date,
  ): Promise<void> {
    let rmResumeId: string | null = null;
    try {
      const pdf = await this.documents.jobPdf(userId, jobId, 'resume');
      const uploaded = await this.client.uploadResume({
        name: 'apply-kit-resume.pdf',
        type: 'application/pdf',
        bytes: pdf.bytes,
      });
      rmResumeId = uploaded.resume_id;
      if (uploaded.processing_status !== 'ready') throw new Error(NOT_READ_MESSAGE);
      const rmJobId = await this.client.uploadJob(description, rmResumeId);
      const preview = await this.client.improvePreview(rmResumeId, rmJobId);
      const ats = preview.data.ats_score;
      if (!ats) throw new Error(NO_SCORE_MESSAGE);
      await this.save(userId, jobId, startedAt, {
        aiStatus: JobMatchStatus.READY,
        aiScore: ats.overall_score,
        aiError: null,
      });
    } catch (error) {
      this.logger.warn(`Reply match ${userId}:${jobId} failed: ${describeError(error)}`);
      await this.save(userId, jobId, startedAt, {
        aiStatus: JobMatchStatus.FAILED,
        aiError: describeRunError(error),
      }).catch((e: unknown) => {
        this.logger.warn(`Could not save reply match ${userId}:${jobId}: ${describeError(e)}`);
      });
    } finally {
      if (rmResumeId) {
        await this.client.deleteResume(rmResumeId).catch((e: unknown) => {
          this.logger.warn(`Could not delete the temporary resume: ${describeError(e)}`);
        });
      }
    }
  }

  /** Only while the row is still the run that started: a newly saved resume clears it. */
  private async save(
    userId: number,
    jobId: string,
    startedAt: Date,
    data: { aiStatus: JobMatchStatus; aiScore?: number; aiError: string | null },
  ): Promise<void> {
    await this.prisma.jobResume.updateMany({
      where: { userId, jobId, aiStartedAt: startedAt },
      data,
    });
  }
}
