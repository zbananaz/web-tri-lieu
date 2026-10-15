import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { extractToken } from './auth/auth.guard.js';
import { env } from './config/env.js';
import { originCheck } from './common/origin.middleware.js';
import { MAX_UPLOAD_BYTES, UPLOAD_MIME_TYPES } from './uploads/uploads.controller.js';

/** Cau hinh dung chung cho server that va test e2e (de test chay dung lop bao mat that). */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // Chi tin dung so lop proxy da biet (khach -> reverse proxy -> Next -> API = 2); neu tin thieu thi moi nguoi
  // dung chung mot IP (rate limit sai), neu tin thua thi khach tu gia X-Forwarded-For duoc.
  app.set('trust proxy', env.trustProxyHops > 0 ? env.trustProxyHops : false);
  app.use(helmet());
  app.useBodyParser('json', { limit: '1mb' });
  app.use(cookieParser());
  // Tai anh: chi dua body tho vao bo nho cho yeu cau co phien (cookie/Bearer) va dung kieu anh; quyen admin kiem o guard.
  app.use('/api/admin/uploads', (req: Request, res: Response, next: NextFunction) => {
    if (!extractToken(req)) {
      res.status(401).json({ statusCode: 401, message: 'Vui lòng đăng nhập' });
      return;
    }
    next();
  });
  app.use('/api/admin/uploads', express.raw({ type: UPLOAD_MIME_TYPES, limit: MAX_UPLOAD_BYTES }));
  app.use(originCheck([env.webOrigin]));
  app.enableShutdownHooks();
}
