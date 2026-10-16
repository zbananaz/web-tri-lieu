import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser, ModerateReviewInput, PublicReview, ReviewInput, ReviewStatus } from '@wtl/shared';
import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AuditService } from '../audit/audit.service.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { appointments, reviews, users } from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const pgCode = (e: unknown): string | undefined =>
  (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Khach danh gia mot lich hen cua CHINH MINH da hoan thanh; moi lich mot danh gia, cho quan tri duyet truoc khi hien cong khai. */
  async create(user: AuthUser, appointmentId: string, input: ReviewInput, ip?: string | null) {
    const [a] = await this.db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.clientId, user.id)))
      .limit(1);
    if (!a) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (a.status !== 'completed') throw new ConflictException('Chỉ đánh giá được sau khi buổi hẹn đã hoàn thành');
    try {
      const [row] = await this.db
        .insert(reviews)
        .values({ appointmentId, expertId: a.expertId, clientId: user.id, rating: input.rating, comment: input.comment })
        .returning({ id: reviews.id, status: reviews.status });
      await this.audit.log({ actorId: user.id, action: 'review.create', entity: 'appointment', entityId: appointmentId, ip });
      return row!;
    } catch (e) {
      if (pgCode(e) === '23505') throw new ConflictException('Bạn đã đánh giá buổi hẹn này');
      throw e;
    }
  }

  async mine(user: AuthUser) {
    return this.db
      .select({ appointmentId: reviews.appointmentId, rating: reviews.rating, comment: reviews.comment, status: reviews.status })
      .from(reviews)
      .where(eq(reviews.clientId, user.id))
      .orderBy(desc(reviews.createdAt))
      .limit(200);
  }

  /** Cong khai: chi danh gia da duyet, KHONG co ten khach (nguoi tim tri lieu la thong tin nhay cam). */
  async publicForExpert(expertId: string): Promise<PublicReview[]> {
    const rows = await this.db
      .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt })
      .from(reviews)
      .where(and(eq(reviews.expertId, expertId), eq(reviews.status, 'published')))
      .orderBy(desc(reviews.createdAt))
      .limit(50);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async adminList(status?: ReviewStatus) {
    const clientU = alias(users, 'client_u');
    const expertU = alias(users, 'expert_u');
    const rows = await this.db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        status: reviews.status,
        createdAt: reviews.createdAt,
        clientName: clientU.fullName,
        expertId: reviews.expertId,
        expertName: expertU.fullName,
      })
      .from(reviews)
      .innerJoin(clientU, eq(clientU.id, reviews.clientId))
      .innerJoin(expertU, eq(expertU.id, reviews.expertId))
      .where(status ? eq(reviews.status, status) : undefined)
      .orderBy(desc(reviews.createdAt))
      .limit(200);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async moderate(actor: AuthUser, id: string, input: ModerateReviewInput, ip?: string | null) {
    const [row] = await this.db
      .update(reviews)
      .set({ status: input.status, moderatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id, status: reviews.status, expertId: reviews.expertId });
    if (!row) throw new NotFoundException('Không tìm thấy đánh giá');
    await this.audit.log({ actorId: actor.id, action: `review.${input.status}`, entity: 'review', entityId: id, ip });
    if (input.status === 'published') await this.notifications.notify(row.expertId, 'review.published', 'Bạn có một đánh giá mới', '/expert');
    return { id: row.id, status: row.status };
  }
}
