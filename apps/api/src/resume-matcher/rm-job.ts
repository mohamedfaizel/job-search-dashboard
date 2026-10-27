import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatcherResumeStatus } from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import type { ResumeMatcherClient } from './resume-matcher.client';
import { ResumeMatcherHttpError } from './resume-matcher.client';

const NO_RESUME_MESSAGE = 'Send your resume to Resume-Matcher on My profile first, then try again.';

/** What a Resume-Matcher run on one job needs, gathered and checked before it starts. */
export interface RmJobInput {
  rmResumeId: string;
  /** The job text sent to Resume-Matcher. */
  description: string;
  resumeFileName: string;
  resumeSyncedAt: Date;
}

/** Throws a message for the user when the job has no text or the resume isn't in Resume-Matcher. */
export async function loadRmJobInput(
  prisma: PrismaService,
  userId: number,
  jobId: string,
): Promise<RmJobInput> {
  const [job, resume] = await Promise.all([
    prisma.job.findUnique({
      where: { id: jobId },
      select: { title: true, description: true, company: { select: { name: true } } },
    }),
    prisma.matcherResume.findUnique({ where: { userId } }),
  ]);
  if (!job) throw new NotFoundException(`Job ${jobId} not found`);
  if (!job.description?.trim()) {
    throw new BadRequestException('This job has no description to compare your resume with.');
  }
  if (resume?.status !== MatcherResumeStatus.READY || !resume.rmResumeId) {
    throw new BadRequestException(NO_RESUME_MESSAGE);
  }
  return {
    rmResumeId: resume.rmResumeId,
    // The title and company help Resume-Matcher find the role for its title score.
    description: `${job.title} at ${job.company.name}\n\n${job.description}`,
    resumeFileName: resume.fileName,
    resumeSyncedAt: resume.syncedAt,
  };
}

/**
 * Runs `call` with Resume-Matcher's id for the job, sending the job text first when there is no
 * id yet. If Resume-Matcher lost its copy (its data was reset), the job is sent again, once.
 * `ref.rmJobId` always holds the latest id, even when `call` fails, so the caller can save it.
 */
export async function withRmJob<T>(
  client: ResumeMatcherClient,
  input: RmJobInput,
  ref: { rmJobId: string | null },
  call: (rmJobId: string) => Promise<T>,
): Promise<T> {
  const upload = async () => {
    ref.rmJobId = await client.uploadJob(input.description, input.rmResumeId);
    return ref.rmJobId;
  };
  if (!ref.rmJobId) return call(await upload());
  try {
    return await call(ref.rmJobId);
  } catch (error) {
    if (!isMissingJob(error)) throw error;
    return call(await upload());
  }
}

function isMissingJob(error: unknown): boolean {
  return (
    error instanceof ResumeMatcherHttpError &&
    error.rmStatus === 404 &&
    (error.detail ?? '').toLowerCase().includes('job')
  );
}
