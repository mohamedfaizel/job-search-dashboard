import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
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
import { send } from '../insights/job-resume.controller';
import type { UploadedResume } from '../profile/resume-text';
import type { DocumentStyleModel } from './documents.model';
import { DocumentsService, MAX_PHOTO_BYTES } from './documents.service';

/**
 * The photo for your resume, and sample PDFs to compare templates. Files are plain REST, like
 * the resume uploads; the style itself is GraphQL.
 */
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('photo')
  @Header('Cache-Control', 'no-store')
  async photo(
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return send(res, await this.documents.photo(user.id), 'inline');
  }

  @Post('photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES } }))
  uploadPhoto(
    @CurrentUser() user: SessionUser,
    @UploadedFile() file: UploadedResume | undefined,
  ): Promise<DocumentStyleModel> {
    if (!file) throw new BadRequestException('Choose a photo to upload');
    return this.documents.savePhoto(user.id, file.mimetype, file.buffer);
  }

  @Delete('photo')
  deletePhoto(@CurrentUser() user: SessionUser): Promise<DocumentStyleModel> {
    return this.documents.deletePhoto(user.id);
  }

  /** A sample resume in a template, opened in the browser: ?template=modern&accent=0E7C66&font=serif */
  @Get('preview/resume.pdf')
  async previewResume(
    @CurrentUser() user: SessionUser,
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return send(res, await this.documents.preview(user.id, 'resume', query), 'inline');
  }

  /** A sample cover letter: ?layout=din&template=classic */
  @Get('preview/cover-letter.pdf')
  async previewCoverLetter(
    @CurrentUser() user: SessionUser,
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return send(res, await this.documents.preview(user.id, 'cover-letter', query), 'inline');
  }
}
