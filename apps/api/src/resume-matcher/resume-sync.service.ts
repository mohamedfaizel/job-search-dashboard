import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { MatcherResumeStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResumeMatcherClient, ResumeMatcherHttpError } from './resume-matcher.client';
import { MatcherResumeModel, MatcherResumeState } from './resume-matcher.model';

const NO_FILE_MESSAGE =
  'Upload your resume as a PDF or Word file on this page so Resume-Matcher can use it.';
const AI_FAILED_MESSAGE =
  "Resume-Matcher got the file, but its AI couldn't read it. Check the key with Test AI connection, then send it again.";

/**
 * Keeps one copy of each user's master resume in Resume-Matcher. Resume-Matcher has no users,
 * so the MatcherResume row remembers which of its resumes belongs to whom.
 */
@Injectable()
export class ResumeSyncService {
  /** Users with a send in progress, so a double click doesn't upload twice. */
  private readonly sending = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ResumeMatcherClient,
  ) {}

  async get(userId: number): Promise<MatcherResumeModel> {
    const [profile, copy] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { resumeFileName: true, resumeUploadedAt: true },
      }),
      this.prisma.matcherResume.findUnique({ where: { userId } }),
    ]);
    const uploadedAt = profile?.resumeUploadedAt ?? null;
    const base = { fileName: copy?.fileName ?? null, syncedAt: copy?.syncedAt ?? null };

    if (!uploadedAt) {
      return { ...base, state: MatcherResumeState.NO_FILE, message: NO_FILE_MESSAGE };
    }
    if (!copy) {
      return {
        ...base,
        state: MatcherResumeState.NOT_SENT,
        message: `${profile?.resumeFileName ?? 'Your resume'} hasn't been sent to Resume-Matcher yet.`,
      };
    }
    if (copy.syncedAt < uploadedAt) {
      return {
        ...base,
        state: MatcherResumeState.OUTDATED,
        message: 'You uploaded a newer resume. Send it again so jobs are matched against it.',
      };
    }
    if (copy.status === MatcherResumeStatus.FAILED) {
      return {
        ...base,
        state: MatcherResumeState.FAILED,
        message: copy.error ?? AI_FAILED_MESSAGE,
      };
    }
    return {
      ...base,
      state: MatcherResumeState.READY,
      message: `Resume-Matcher has read ${copy.fileName}. Jobs will be matched against it.`,
    };
  }

  /**
   * Sends the uploaded file to Resume-Matcher, replacing the user's previous copy there.
   * Waits while its AI reads the resume, which can take a minute. Problems are saved on the
   * row and shown as the FAILED state rather than thrown, so the page can explain them.
   */
  async sync(userId: number): Promise<MatcherResumeModel> {
    if (this.sending.has(userId)) {
      throw new ConflictException('Your resume is already being sent. Wait for it to finish.');
    }
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { resumeFile: true, resumeFileName: true, resumeFileType: true },
    });
    if (!profile?.resumeFile || !profile.resumeFileName) {
      throw new BadRequestException(NO_FILE_MESSAGE);
    }
    const file = {
      name: profile.resumeFileName,
      type: profile.resumeFileType ?? 'application/octet-stream',
      bytes: profile.resumeFile,
    };

    this.sending.add(userId);
    try {
      const previous = await this.prisma.matcherResume.findUnique({ where: { userId } });
      // Until the old copy is gone, keep pointing at it so a later send can still delete it.
      let rmResumeId = previous?.rmResumeId ?? null;
      let status: MatcherResumeStatus = MatcherResumeStatus.FAILED;
      let error: string | null;
      try {
        // Resume-Matcher keeps at most 5 master resumes in total, so replace, don't add.
        if (rmResumeId) {
          await this.deleteIfPresent(rmResumeId);
          rmResumeId = null;
        }
        const uploaded = await this.client.uploadResume(file);
        rmResumeId = uploaded.resume_id;
        if (uploaded.processing_status === 'ready') {
          status = MatcherResumeStatus.READY;
          error = null;
        } else {
          error = AI_FAILED_MESSAGE;
        }
      } catch (e) {
        error = describe(e);
      }

      const data = { rmResumeId, status, error, fileName: file.name, syncedAt: new Date() };
      await this.prisma.matcherResume.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    } finally {
      this.sending.delete(userId);
    }
    return this.get(userId);
  }

  private async deleteIfPresent(rmResumeId: string): Promise<void> {
    try {
      await this.client.deleteResume(rmResumeId);
    } catch (e) {
      // Already gone (someone deleted it in Resume-Matcher's own screens): nothing to do.
      if (!(e instanceof ResumeMatcherHttpError && e.rmStatus === 404)) throw e;
    }
  }
}

/** Turns a failure into a sentence that says what to do next. */
function describe(error: unknown): string {
  if (error instanceof ResumeMatcherHttpError) {
    if (error.rmStatus === 409 && error.path === '/resumes/upload') {
      return 'Resume-Matcher already holds 5 master resumes, its limit. Delete an old one in its own screens (http://localhost:3100), then send again.';
    }
    return error.detail ?? error.message;
  }
  const text = error instanceof Error ? error.message : String(error);
  return text.includes('not reachable') ? `${text}. Start it with pnpm rm:up.` : text;
}
