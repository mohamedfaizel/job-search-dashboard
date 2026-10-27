import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import type { ProfileModel } from './profile.model';
import { ProfileService } from './profile.service';
import type { UploadedResume } from './resume-text';
import { extractResumeText } from './resume-text';

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/**
 * File uploads use a plain REST endpoint: multipart/form-data is what browsers send for files,
 * and GraphQL has no built-in way to carry them.
 */
@Controller('profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Post('resume')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RESUME_BYTES } }))
  async uploadResume(
    @CurrentUser() user: SessionUser,
    @UploadedFile() file: UploadedResume | undefined,
  ): Promise<ProfileModel> {
    if (!file) throw new BadRequestException('Choose a file to upload');
    const text = await extractResumeText(file);
    return this.profiles.saveResume(
      user.id,
      { name: file.originalname, type: file.mimetype, bytes: file.buffer },
      text,
    );
  }
}
