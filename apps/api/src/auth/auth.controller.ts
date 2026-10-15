import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthUser,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from '@wtl/shared';
import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';
import { CurrentUser, Public } from '../common/decorators.js';
import { rateLimit } from '../common/limits.js';
import { SESSION_COOKIE } from '../common/origin.middleware.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AuthService, type RequestMeta } from './auth.service.js';
import { SessionService } from './session.service.js';

// Nguong gioi han dang nhap/dang ky theo IP. Moi request test deu cung mot IP nen nuoi long o moi truong test;
// viec chong do mat khau van duoc kiem chung rieng qua co che khoa tai khoan.
const AUTH_LIMIT = rateLimit(20);

const metaOf = (req: Request): RequestMeta => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  path: '/',
  ...(expires ? { expires } : {}),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle({ default: { limit: AUTH_LIMIT, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body(new ZodPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.auth.register(body, metaOf(req));
    res.cookie(SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: AUTH_LIMIT, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.auth.login(body, metaOf(req));
    res.cookie(SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));
    return { user };
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    if (req.sessionId) await this.sessions.revoke(req.sessionId);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @HttpCode(204)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.changePassword(user, req.sessionId, body, metaOf(req));
  }
}
