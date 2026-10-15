import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuthUser, MarkReadInput, NotificationDto } from '@wtl/shared';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { notifications } from '../db/schema.js';

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Tao thong bao cho mot nguoi. Thong bao la phu tro: loi o day khong duoc lam hong nghiep vu goi no. */
  async notify(userId: string, type: string, title: string, link?: string): Promise<void> {
    try {
      await this.db.insert(notifications).values({ userId, type, title: title.slice(0, 200), link: link ?? null });
    } catch (e) {
      this.log.warn(`Khong tao duoc thong bao (${type}): ${(e as Error).message}`);
    }
  }

  async list(user: AuthUser): Promise<{ notifications: NotificationDto[]; unread: number }> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    const [{ count } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return {
      notifications: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        link: r.link,
        read: !!r.readAt,
        createdAt: r.createdAt.toISOString(),
      })),
      unread: count,
    };
  }

  /** Chi danh dau thong bao cua chinh nguoi goi; id cua nguoi khac bi bo qua. */
  async markRead(user: AuthUser, input: MarkReadInput): Promise<void> {
    const own = and(eq(notifications.userId, user.id), isNull(notifications.readAt));
    if (input.all) {
      await this.db.update(notifications).set({ readAt: new Date() }).where(own);
    } else if (input.ids?.length) {
      await this.db.update(notifications).set({ readAt: new Date() }).where(and(own, inArray(notifications.id, input.ids)));
    }
  }
}

