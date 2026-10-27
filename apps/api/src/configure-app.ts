import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { createValidationPipe } from './common/validation.pipe';

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:6006',
];

/** Shared by main.ts and the tests, so both run the API the same way. */
export function configureApp(app: INestApplication): void {
  // Reads the session cookie into req.cookies.
  app.use(cookieParser());
  // The microfrontends run on their own ports. With cookies, CORS must name each allowed
  // origin (a wildcard is not allowed) and opt in to credentials.
  const origins = process.env['CORS_ORIGINS']?.split(',').map((o) => o.trim()) ?? DEV_ORIGINS;
  app.enableCors({ origin: origins, credentials: true });
  // Runs the class-validator rules on every GraphQL input.
  app.useGlobalPipes(createValidationPipe());
}
