import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@wtl/shared';
import type { Request } from 'express';
import { IS_PUBLIC, ROLES_KEY } from '../common/decorators.js';
import { SESSION_COOKIE } from '../common/origin.middleware.js';
import { SessionService } from './session.service.js';

export function extractToken(req: Request): { token: string; via: 'cookie' | 'bearer' } | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return { token: header.slice(7).trim(), via: 'bearer' };
  const cookie = req.cookies?.[SESSION_COOKIE];
  if (typeof cookie === 'string' && cookie) return { token: cookie, via: 'cookie' };
  return null;
}

/** Xac thuc phien. Route @Public van duoc nhan dien user neu co token hop le. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<Request>();
    const found = extractToken(req);
    const resolved = found ? await this.sessions.resolve(found.token) : null;
    if (resolved && found) {
      req.user = resolved.user;
      req.sessionId = resolved.sessionId;
      req.authVia = found.via;
    }
    if (isPublic) return true;
    if (!resolved) throw new UnauthorizedException('Vui lòng đăng nhập');
    return true;
  }
}

/** Kiem tra vai tro theo @Roles. Day la lop phan quyen thang chinh; kiem tra doi tuong nam o service. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    return true;
  }
}
