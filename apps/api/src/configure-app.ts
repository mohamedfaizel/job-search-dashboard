import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createValidationPipe } from './common/validation.pipe';
import { PDF_HEADERS } from './resume-builder/resume-builder.controller';

// The Next.js app (apps/web) and Storybook.
// The web app, Storybook and the phone app's web preview (Expo, port 8081).
const DEV_ORIGINS = ['http://localhost:3001', 'http://localhost:6006', 'http://localhost:8081'];

/** Shared by main.ts and the tests, so both run the API the same way. */
export function configureApp(app: INestApplication): void {
  // Safe browser headers on every answer (no sniffing file types, no framing by other sites,
  // HTTPS only once deployed). The strict content rules only in production: in development
  // they would block the GraphQL sandbox page. "same-site" lets the web app on another port
  // or subdomain show the API's photos and PDFs.
  const production = process.env['NODE_ENV'] === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: production,
      crossOriginResourcePolicy: { policy: 'same-site' },
      strictTransportSecurity: production,
    }),
  );
  // Reads the session cookie into req.cookies.
  app.use(cookieParser());
  // The web app runs on its own port. With cookies, CORS must name each allowed origin (a
  // wildcard is not allowed) and opt in to credentials.
  const origins = process.env['CORS_ORIGINS']?.split(',').map((o) => o.trim()) ?? DEV_ORIGINS;
  // exposedHeaders: the Resume builder's preview reads the page count from its PDF response.
  app.enableCors({ origin: origins, credentials: true, exposedHeaders: PDF_HEADERS });
  // Runs the class-validator rules on every GraphQL input.
  app.useGlobalPipes(createValidationPipe());
}
