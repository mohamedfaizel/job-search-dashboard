import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // The microfrontends run on their own dev ports, so the browser needs CORS.
  app.enableCors();
  // Runs the class-validator rules on every GraphQL input.
  app.useGlobalPipes(createValidationPipe());
  const port = Number(process.env['API_PORT'] ?? 3000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port} (GraphQL at /graphql)`);
}

void bootstrap();
