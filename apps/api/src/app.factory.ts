import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env.js';
import { originCheck } from './common/origin.middleware.js';

/** Cau hinh dung chung cho server that va test e2e (de test chay dung lop bao mat that). */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // Sau reverse proxy (production) moi tin X-Forwarded-For de lay IP that.
  app.set('trust proxy', env.isProd ? 1 : false);
  app.use(helmet());
  app.useBodyParser('json', { limit: '1mb' });
  app.use(cookieParser());
  app.use(originCheck([env.webOrigin]));
  app.enableShutdownHooks();
}
