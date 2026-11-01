import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { createValidationPipe } from './common/validation.pipe';

// The Next.js app (apps/web) and Storybook.
const DEV_ORIGINS = ['http://localhost:3001', 'http://localhost:6006'];

/** Shared by main.ts and the tests, so both run the API the same way. */
export function configureApp(app: INestApplication): void {
  // Reads the session cookie into req.cookies.
  app.use(cookieParser());
  // The web app runs on its own port. With cookies, CORS must name each allowed origin (a
  // wildcard is not allowed) and opt in to credentials.
  const origins = process.env['CORS_ORIGINS']?.split(',').map((o) => o.trim()) ?? DEV_ORIGINS;
  app.enableCors({ origin: origins, credentials: true });
  // Runs the class-validator rules on every GraphQL input.
  app.useGlobalPipes(createValidationPipe());
}
