import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { DocumentsService } from '../documents/documents.service';
import type { DocumentFile } from '../documents/documents.service';
import { MAX_RESUME_BYTES } from '../profile/profile.controller';
import type { UploadedResume } from '../profile/resume-text';
import { extractResumeText } from '../profile/resume-text';
import type { JobInsightsModel } from './insights.model';
import { InsightsService } from './insights.service';

/** Claude often answers in plain text or Markdown, so those are accepted next to PDF and Word. */
const isText = (file: UploadedResume) =>
  file.mimetype.startsWith('text/') || /\.(txt|md)$/i.test(file.originalname);
const isDocument = (file: UploadedResume) => /\.(pdf|docx)$/i.test(file.originalname);

/**
 * The resume you wrote for one job. Upload and download are plain REST, like the profile
 * resume: browsers send files as multipart/form-data and save downloads from a link, and the
 * login cookie goes with both. Pasting text and deleting are GraphQL mutations.
 */
@Controller('job-resume')
export class JobResumeController {
  constructor(
    private readonly insights: InsightsService,
    private readonly documents: DocumentsService,
  ) {}

  @Post(':jobId')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RESUME_BYTES } }))
  async upload(
    @CurrentUser() user: SessionUser,
    @Param('jobId') jobId: string,
    @UploadedFile() file: UploadedResume | undefined,
  ): Promise<JobInsightsModel> {
    if (!file) throw new BadRequestException('Choose a file to upload');
    if (!isText(file) && !isDocument(file)) {
      throw new BadRequestException('Upload a PDF, Word (.docx), text or Markdown file');
    }
    const text = isText(file) ? file.buffer.toString('utf8') : await extractResumeText(file);
    return this.insights.saveJobResume(user.id, jobId, text, {
      name: file.originalname,
      type: file.mimetype,
      bytes: file.buffer,
    });
  }

  /**
   * The saved resume as a PDF in your template, named like
   * "Mohamed-Faizel-Resume-ComputerFutures.pdf". ?template=modern picks another template for
   * this download.
   */
  @Get(':jobId/resume.pdf')
  async resumePdf(
    @CurrentUser() user: SessionUser,
    @Param('jobId') jobId: string,
    @Query('template') template: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return send(res, await this.documents.jobPdf(user.id, jobId, 'resume', template));
  }

  /** The saved resume as an editable Word file, in the layout of your own Word resume. */
  @Get(':jobId/resume.docx')
  async resumeDocx(
    @CurrentUser() user: SessionUser,
    @Param('jobId') jobId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return send(res, await this.documents.jobDocx(user.id, jobId));
  }

  @Get(':jobId/cover-letter.pdf')
  async coverLetterPdf(
    @CurrentUser() user: SessionUser,
    @Param('jobId') jobId: string,
    @Query('template') template: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return send(res, await this.documents.jobPdf(user.id, jobId, 'cover-letter', template));
  }

  @Get(':jobId')
  async download(
    @CurrentUser() user: SessionUser,
    @Param('jobId') jobId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return send(res, await this.insights.jobResumeFile(user.id, jobId));
  }
}

/** Sends a file as a download, keeping its name. */
export function send(
  res: Response,
  file: DocumentFile,
  disposition = 'attachment',
): StreamableFile {
  res.set({
    'Content-Type': file.type,
    // filename* carries names with accents or spaces; filename is the plain fallback.
    'Content-Disposition': `${disposition}; filename="${file.name.replace(/[^\w.-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  });
  return new StreamableFile(file.bytes);
}
