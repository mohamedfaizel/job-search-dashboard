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
    plainText(res);
    return this.insights.applyKit(
      user.id,
      jobId,
      `${origin(req)}/job-resume/${encodeURIComponent(jobId)}`,
    );
  }
}

/** The Apply queue page: every job you lined up, each with its posting and Apply kit link. */
@Controller('apply-queue')
export class ApplyQueueController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  async page(
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    plainText(res);
    return this.insights.applyQueuePage(
      user.id,
      (jobId) => `${origin(req)}/apply-kit/${encodeURIComponent(jobId)}`,
    );
  }
}

/** This API's own address, as the browser reached it, for links on the pages. */
const origin = (req: Request) => `${req.protocol}://${req.get('host') ?? 'localhost:3000'}`;

function plainText(res: Response) {
  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    // Personal details: never kept in a shared cache.
    'Cache-Control': 'no-store',
  });
}
