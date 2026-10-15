import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { ResetPasswordInput } from '@wtl/shared';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { env } from '../config/env.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { passwordResetTokens, users } from '../db/schema.js';
import { MailerService } from '../mail/mailer.service.js';
import { hashPassword } from './password.js';
import { SessionService } from './session.service.js';

const TOKEN_TTL_MINUTES = 45;
const MAX_REQUESTS_PER_HOUR = 3;
const INVALID = 'Liên kết không hợp lệ hoặc đã hết hạn';

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly log = new Logger(PasswordResetService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly mailer: MailerService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Chay NGAY SAU KHI da tra 204 cho nguoi goi (khong await o controller), nen thoi gian phan hoi khong lo email co ton tai hay khong.
   * Gioi han theo email: toi da 3 yeu cau/gio, vuot thi im lang bo qua. Khong gui cho tai khoan bi khoa.
   */
  async request(email: string, ip?: string | null): Promise<void> {
    try {
      const [u] = await this.db
        .select({ id: users.id, email: users.email, status: users.status })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!u || u.status !== 'active') return;
      const [{ recent } = { recent: 0 }] = await this.db
        .select({ recent: sql<number>`count(*)::int` })
        .from(passwordResetTokens)
        .where(and(eq(passwordResetTokens.userId, u.id), gt(passwordResetTokens.createdAt, new Date(Date.now() - 3_600_000))));
      if (recent >= MAX_REQUESTS_PER_HOUR) return;

      const token = randomBytes(32).toString('base64url'); // 256 bit
      await this.db.insert(passwordResetTokens).values({
        userId: u.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
      });
      // Lien ket dung WEB_ORIGIN (khong lay tu header Host); token nam o fragment de khong vao log may chu.
      const link = `${env.webOrigin.replace(/\/+$/, '')}/reset-password#token=${token}`;
      await this.mailer.send({
        to: u.email,
        subject: 'Đặt lại mật khẩu',
        text:
          `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu.\n\n` +
          `Mở liên kết sau trong ${TOKEN_TTL_MINUTES} phút để đặt mật khẩu mới:\n${link}\n\n` +
          `Nếu không phải bạn, hãy bỏ qua thư này; mật khẩu hiện tại vẫn an toàn.`,
      });
      await this.audit.log({ actorId: u.id, action: 'auth.forgot_password', entity: 'user', entityId: u.id, ip });
    } catch (e) {
      this.log.warn(`Quen mat khau that bai: ${(e as Error).message}`);
    }
  }

  async reset(input: ResetPasswordInput, ip?: string | null): Promise<void> {
    const passwordHash = await hashPassword(input.newPassword);
    const userId = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId, status: users.status })
        .from(passwordResetTokens)
        .innerJoin(users, eq(users.id, passwordResetTokens.userId))
        .where(
          and(
            eq(passwordResetTokens.tokenHash, hashToken(input.token)),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .for('update', { of: passwordResetTokens })
        .limit(1);
      if (!row || row.status !== 'active') throw new BadRequestException(INVALID);
      await tx
        .update(users)
        .set({ passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null, updatedAt: new Date() })
        .where(eq(users.id, row.userId));
      // Moi token con lai cua nguoi nay cung het hieu luc.
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, row.userId));
      return row.userId;
    });
    await this.sessions.revokeAllForUser(userId);
    await this.audit.log({ actorId: userId, action: 'auth.reset_password', entity: 'user', entityId: userId, ip });
  }
}
