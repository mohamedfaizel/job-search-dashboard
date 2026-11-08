import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { JobResumeBuildModel, ResumeBuildModel } from './resume-builder.model';
import { ResumeBuilderService } from './resume-builder.service';

/** Each user edits only their own resumes: the id comes from the session cookie. */
@Resolver()
export class ResumeBuilderResolver {
  constructor(private readonly builder: ResumeBuilderService) {}

  @Query(() => ResumeBuildModel, {
    description: 'Your master resume as sections; your main language when none is given',
  })
  resumeBuild(
    @CurrentUser() user: SessionUser,
    @Args('language', { type: () => String, nullable: true }) language?: string | null,
  ): Promise<ResumeBuildModel> {
    return this.builder.get(user.id, language);
  }

  @Query(() => String, {
    description: 'AI chat prompt that puts your resume text into the builder layout',
  })
  resumeBuildPrompt(
    @CurrentUser() user: SessionUser,
    @Args('language') language: string,
  ): Promise<string> {
    return this.builder.prompt(user.id, language);
  }

  @Mutation(() => ResumeBuildModel, {
    description: 'Saves the builder resume (JSON text) and writes it to My profile as text',
  })
  saveResumeBuild(
    @CurrentUser() user: SessionUser,
    @Args('language') language: string,
    @Args('doc') doc: string,
  ): Promise<ResumeBuildModel> {
    return this.builder.save(user.id, language, doc);
  }

  @Mutation(() => ResumeBuildModel, {
    description: 'Reads the resume into sections again: from My profile, or from an AI chat reply',
  })
  restartResumeBuild(
    @CurrentUser() user: SessionUser,
    @Args('language') language: string,
    @Args('reply', { type: () => String, nullable: true }) reply?: string | null,
  ): Promise<ResumeBuildModel> {
    return this.builder.restart(user.id, language, reply?.slice(0, 60_000));
  }

  @Query(() => JobResumeBuildModel, {
    description: 'Your resume for one job (your master resume until you start a copy)',
  })
  jobResumeBuild(
    @CurrentUser() user: SessionUser,
    @Args('jobId') jobId: string,
  ): Promise<JobResumeBuildModel> {
    return this.builder.getJob(user.id, jobId);
  }

  @Mutation(() => JobResumeBuildModel, {
    description: 'Starts a resume copy for a job from your master resume',
  })
  startJobResumeBuild(
    @CurrentUser() user: SessionUser,
    @Args('jobId') jobId: string,
  ): Promise<JobResumeBuildModel> {
    return this.builder.startJob(user.id, jobId);
  }

  @Mutation(() => JobResumeBuildModel, { description: 'Saves a job’s resume (JSON text)' })
  saveJobResumeBuild(
    @CurrentUser() user: SessionUser,
    @Args('jobId') jobId: string,
    @Args('doc') doc: string,
  ): Promise<JobResumeBuildModel> {
    return this.builder.saveJob(user.id, jobId, doc);
  }

  @Mutation(() => JobResumeBuildModel, {
    description: 'Throws a job’s changes away: the copy becomes your master resume again',
  })
  resetJobResumeBuild(
    @CurrentUser() user: SessionUser,
    @Args('jobId') jobId: string,
  ): Promise<JobResumeBuildModel> {
    return this.builder.resetJob(user.id, jobId);
  }

  @Mutation(() => JobResumeBuildModel, {
    description: 'Puts one section of a job’s resume into your master resume',
  })
  copySectionToMaster(
    @CurrentUser() user: SessionUser,
    @Args('jobId') jobId: string,
    @Args('sectionId') sectionId: string,
  ): Promise<JobResumeBuildModel> {
    return this.builder.copySectionToMaster(user.id, jobId, sectionId);
  }
}
