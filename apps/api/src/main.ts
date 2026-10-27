import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = Number(process.env['API_PORT'] ?? 3000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port} (GraphQL at /graphql)`);
}

void bootstrap();
