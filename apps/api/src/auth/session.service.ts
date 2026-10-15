import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '@wtl/shared';
import { and, eq, gt, ne } from 'drizzle-orm';
import { env } from '../config/env.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { sessions, users } from '../db/schema.js';

const TOUCH_INTERVAL_MS = 60_000;

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export interface ResolvedSession {
  user: AuthUser;
  sessionId: string;
}

@Injectable()
export class SessionService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(userId: string, meta: { ip?: string | null; userAgent?: string | null }) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);
    await this.db.insert(sessions).values({
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    });
    return { token, expiresAt };
  }

  /** Tra ve user + id phien neu token hop le, chua het han va tai khoan con hoat dong. */
  async resolve(token: string): Promise<ResolvedSession | null> {
    const now = new Date();
    const [row] = await this.db
      .select({
        sessionId: sessions.id,
        lastUsedAt: sessions.lastUsedAt,
        id: users.id,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
        mustChangePassword: users.mustChangePassword,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now), eq(users.status, 'active')))
      .limit(1);
    if (!row) return null;
    if (now.getTime() - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.db.update(sessions).set({ lastUsedAt: now }).where(eq(sessions.id, row.sessionId));
    }
    return {
      sessionId: row.sessionId,
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        fullName: row.fullName,
        ...(row.mustChangePassword ? { mustChangePassword: true } : {}),
      },
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.db
      .delete(sessions)
      .where(
        exceptSessionId
          ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
          : eq(sessions.userId, userId),
      );
  }
}
