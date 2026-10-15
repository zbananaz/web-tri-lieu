import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CHAT_OPEN_STATUSES, type AuthUser, type ChatMessage } from '@wtl/shared';
import { and, count, desc, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { CasesService } from '../cases/cases.service.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { cases, messages } from '../db/schema.js';
import { RealtimeService } from './realtime.service.js';

const toDto = (m: typeof messages.$inferSelect): ChatMessage => ({
  id: m.id,
  caseId: m.caseId,
  senderId: m.senderId,
  body: m.body,
  createdAt: m.createdAt.toISOString(),
  readAt: m.readAt?.toISOString() ?? null,
});

@Injectable()
export class ChatService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(user: AuthUser, caseId: string, before: string | undefined, limit: number, ip?: string | null) {
    await this.cases.assertAccess(user, caseId);
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.caseId, caseId), before ? lt(messages.createdAt, new Date(before)) : undefined))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    // Admin doc noi dung chat: luon ghi audit (khong ghi noi dung).
    if (user.role === 'admin') {
      await this.audit.log({ actorId: user.id, action: 'chat.read', entity: 'case', entityId: caseId, ip });
    }
    return rows.reverse().map(toDto);
  }

  /** Chi khach (chu ca) va chuyen gia duoc phan moi nhan tin, va chi khi ca dang hoat dong. Admin chi xem. */
  async send(user: AuthUser, caseId: string, body: string): Promise<ChatMessage> {
    const c = await this.cases.assertAccess(user, caseId);
    if (user.role === 'admin') throw new ForbiddenException('Quản trị viên chỉ có quyền xem cuộc trò chuyện');
    if (!c.assignedExpertId || !CHAT_OPEN_STATUSES.includes(c.status)) {
      throw new ConflictException('Cuộc trò chuyện chưa mở hoặc đã kết thúc');
    }
    const [row] = await this.db.insert(messages).values({ caseId, senderId: user.id, body }).returning();
    const dto = toDto(row!);
    this.realtime.emitMessage(dto);
    return dto;
  }

  async markRead(user: AuthUser, caseId: string) {
    await this.cases.assertAccess(user, caseId);
    if (user.role === 'admin') return { updated: 0 };
    const res = await this.db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.caseId, caseId), ne(messages.senderId, user.id), isNull(messages.readAt)))
      .returning({ id: messages.id });
    return { updated: res.length };
  }

  /** So tin chua doc theo tung ca cua toi (toi la khach hoac chuyen gia cua ca do). */
  async unread(user: AuthUser) {
    if (user.role === 'admin') return { total: 0, byCase: {} as Record<string, number> };
    const rows = await this.db
      .select({ caseId: messages.caseId, n: count() })
      .from(messages)
      .innerJoin(cases, eq(cases.id, messages.caseId))
      .where(
        and(
          or(eq(cases.clientId, user.id), eq(cases.assignedExpertId, user.id)),
          inArray(cases.status, ['assigned', 'contacted', 'in_treatment', 'closed']),
          ne(messages.senderId, user.id),
          isNull(messages.readAt),
        ),
      )
      .groupBy(messages.caseId);
    const byCase = Object.fromEntries(rows.map((r) => [r.caseId, Number(r.n)]));
    return { total: rows.reduce((s, r) => s + Number(r.n), 0), byCase };
  }
}
