import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { InsightsService } from './insights.service';

/**
 * The Apply kit page as plain text, at a link Claude in Chrome can open in your browser. Your
 * login cookie goes with it, like the resume downloads, so only you can read your kit.
 */
@Controller('apply-kit')
export class ApplyKitController {
  constructor(private readonly insights: InsightsService) {}

  @Get(':jobId')
  async page(
    @CurrentUser() user: SessionUser,
    @Param('jobId') jobId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const resumeUrl = `${req.protocol}://${req.get('host') ?? 'localhost:3000'}/job-resume/${encodeURIComponent(jobId)}`;
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      // Personal details: never kept in a shared cache.
      'Cache-Control': 'no-store',
    });
    return this.insights.applyKit(user.id, jobId, resumeUrl);
  }
}
