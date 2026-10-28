import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { TailorService } from './tailor.service';

/**
 * PDF downloads use plain REST: a link the browser opens and saves, which GraphQL can't serve.
 * The login cookie goes with the link, so each user only gets their own files.
 */
@Controller('tailored')
export class TailorController {
  constructor(private readonly tailor: TailorService) {}

  @Get(':jobId/resume.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="tailored-resume.pdf"')
  async resume(@CurrentUser() user: SessionUser, @Param('jobId') jobId: string) {
    return new StreamableFile(await this.tailor.pdf(user.id, jobId, 'resume'));
  }

  @Get(':jobId/cover-letter.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="cover-letter.pdf"')
  async coverLetter(@CurrentUser() user: SessionUser, @Param('jobId') jobId: string) {
    return new StreamableFile(await this.tailor.pdf(user.id, jobId, 'cover-letter'));
  }
}
