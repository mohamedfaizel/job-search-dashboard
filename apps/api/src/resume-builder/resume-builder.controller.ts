import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { send } from '../insights/job-resume.controller';
import { ResumeBuilderService } from './resume-builder.service';

/** Headers the builder's preview reads (CORS lets the browser see them, configure-app.ts). */
export const PDF_HEADERS = ['X-Pdf-Pages', 'X-Pdf-Styled'];

@Controller('resume-builder')
export class ResumeBuilderController {
  constructor(private readonly builder: ResumeBuilderService) {}

  /**
   * The builder's resume as a PDF: shown in the preview, or downloaded with ?download=1. The
   * page count and whether the template was used come back as headers.
   */
  @Get(':language/resume.pdf')
  async pdf(
    @CurrentUser() user: SessionUser,
    @Param('language') language: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.builder.pdf(user.id, language);
    res.set({
      'Cache-Control': 'no-store',
      'X-Pdf-Pages': String(file.pages),
      'X-Pdf-Styled': file.styled === false ? '0' : '1',
    });
    return send(res, file, download === '1' ? 'attachment' : 'inline');
  }
}
