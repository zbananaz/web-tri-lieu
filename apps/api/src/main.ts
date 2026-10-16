import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.factory.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  await app.listen(env.apiPort, env.apiHost);
  console.log(`API dang chay tai http://${env.apiHost}:${env.apiPort}/api`);
}
await bootstrap();
