import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.factory.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  await app.listen(env.apiPort, '127.0.0.1');
  console.log(`API dang chay tai http://127.0.0.1:${env.apiPort}/api`);
}
await bootstrap();
