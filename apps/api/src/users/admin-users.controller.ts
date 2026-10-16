import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '@wtl/shared';
import { desc, eq } from 'drizzle-orm';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { generateTempPassword, hashPassword } from '../auth/password.js';
import { SessionService } from '../auth/session.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { rateLimit } from '../common/limits.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { auditLogs, passwordResetTokens, users } from '../db/schema.js';

const statusBody = z.object({ status: z.enum(['active', 'disabled']) });
const auditQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });

@Roles('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async list(@CurrentUser() actor: AuthUser, @Req() req: Request) {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(500);
    await this.audit.log({ actorId: actor.id, action: 'users.list', entity: 'user', ip: req.ip });
    return { users: rows };
  }

  /** Khoa/mo tai khoan. Khoa thi huy toan bo phien dang nhap; khong tu khoa chinh minh. */
  @HttpCode(200)
  @Patch(':id/status')
  async setStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(statusBody)) body: z.infer<typeof statusBody>,
    @Req() req: Request,
  ) {
    if (id === actor.id) throw new BadRequestException('Không thể tự khóa tài khoản của mình');
    const res = await this.db.update(users).set({ status: body.status, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id });
    if (res.length === 0) throw new NotFoundException('Không tìm thấy tài khoản');
    if (body.status === 'disabled') await this.sessions.revokeAllForUser(id);
    await this.audit.log({ actorId: actor.id, action: `user.${body.status}`, entity: 'user', entityId: id, ip: req.ip });
    return { id, status: body.status };
  }

  /**
   * Quen mat khau (chua co email): quan tri cap mat khau tam, hien dung mot lan.
   * Huy moi phien, xoa khoa dang nhap, buoc nguoi dung doi mat khau ngay lan dang nhap sau.
   * Khong dat lai cho quan tri vien (tranh chiem quyen ngang hang) va khong tu dat lai chinh minh (dung doi mat khau).
   */
  @Throttle({ default: { limit: rateLimit(10), ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Post(':id/reset-password')
  async resetPassword(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    if (id === actor.id) throw new BadRequestException('Hãy dùng chức năng đổi mật khẩu cho tài khoản của mình');
    const [target] = await this.db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    if (target.role === 'admin') throw new ForbiddenException('Không thể đặt lại mật khẩu của quản trị viên khác');
    const temporaryPassword = generateTempPassword();
    await this.db
      .update(users)
      .set({
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        failedLogins: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    await this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, id));
    await this.sessions.revokeAllForUser(id);
    await this.audit.log({ actorId: actor.id, action: 'user.reset_password', entity: 'user', entityId: id, ip: req.ip });
    return { id, temporaryPassword };
  }
}

@Roles('admin')
@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async list(@Query(new ZodPipe(auditQuery)) q: z.infer<typeof auditQuery>) {
    const rows = await this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
        actorName: users.fullName,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(desc(auditLogs.id))
      .limit(q.limit);
    return { logs: rows };
  }
}
