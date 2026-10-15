import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser, ChangePasswordInput, LoginInput, RegisterInput } from '@wtl/shared';
import { eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { passwordResetTokens, users } from '../db/schema.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from './password.js';
import { SessionService } from './session.service.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const INVALID_LOGIN = 'Email hoặc mật khẩu không đúng';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput, meta: RequestMeta) {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing) throw new ConflictException('Email này đã được sử dụng');
    const passwordHash = await hashPassword(input.password);
    // Vai tro luon la 'client': khong bao gio nhan role tu nguoi dung.
    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone ?? null,
        role: 'client',
      })
      .returning({ id: users.id, email: users.email, role: users.role, fullName: users.fullName });
    const user: AuthUser = row!;
    await this.audit.log({ actorId: user.id, action: 'auth.register', entity: 'user', entityId: user.id, ip: meta.ip });
    return { user, session: await this.sessions.create(user.id, meta) };
  }

  async login(input: LoginInput, meta: RequestMeta) {
    const [u] = await this.db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (!u) {
      await burnPasswordCheck(input.password);
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    const now = new Date();
    if (u.lockedUntil && u.lockedUntil > now) {
      throw new HttpException(
        'Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau ít phút.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const ok = u.status === 'active' && (await verifyPassword(u.passwordHash, input.password));
    if (!ok) {
      const failed = u.failedLogins + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await this.db
        .update(users)
        .set({
          failedLogins: lock ? 0 : failed,
          lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
        })
        .where(eq(users.id, u.id));
      await this.audit.log({
        actorId: u.id,
        action: lock ? 'auth.login_locked' : 'auth.login_failed',
        entity: 'user',
        entityId: u.id,
        ip: meta.ip,
      });
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    await this.db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, u.id));
    const user: AuthUser = {
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.fullName,
      ...(u.mustChangePassword ? { mustChangePassword: true } : {}),
    };
    await this.audit.log({ actorId: u.id, action: 'auth.login', entity: 'user', entityId: u.id, ip: meta.ip });
    return { user, session: await this.sessions.create(u.id, meta) };
  }

  async changePassword(user: AuthUser, currentSessionId: string | undefined, input: ChangePasswordInput, meta: RequestMeta) {
    const [u] = await this.db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!u || !(await verifyPassword(u.passwordHash, input.currentPassword))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }
    if (input.newPassword === input.currentPassword) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword), mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id)); // lien ket quen mat khau cu het hieu luc
    // Doi mat khau => dang xuat moi thiet bi khac.
    await this.sessions.revokeAllForUser(user.id, currentSessionId);
    await this.audit.log({ actorId: user.id, action: 'auth.change_password', entity: 'user', entityId: user.id, ip: meta.ip });
  }
}
