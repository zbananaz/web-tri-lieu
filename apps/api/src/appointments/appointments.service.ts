import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AuthUser,
  type AvailabilitySlot,
  type BookAppointmentInput,
  CHAT_OPEN_STATUSES,
} from '@wtl/shared';
import { and, desc, eq, gt, inArray, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AuditService } from '../audit/audit.service.js';
import { CasesService } from '../cases/cases.service.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { appointments, expertAvailability, expertProfiles, users } from '../db/schema.js';
import { computeSlots, windowsOverlap } from './slots.js';

const ACTIVE = ['requested', 'confirmed'] as const;
const MIN_LEAD_MINUTES = 120;
const MAX_DAYS = 30;

const pgCode = (e: unknown): string | undefined =>
  (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Gio ranh cua chuyen gia ----------

  async getAvailability(expertId: string) {
    return this.db
      .select({
        weekday: expertAvailability.weekday,
        startMinute: expertAvailability.startMinute,
        endMinute: expertAvailability.endMinute,
      })
      .from(expertAvailability)
      .where(eq(expertAvailability.expertId, expertId))
      .orderBy(expertAvailability.weekday, expertAvailability.startMinute);
  }

  async setAvailability(expertId: string, slots: AvailabilitySlot[], ip?: string | null) {
    if (windowsOverlap(slots)) throw new BadRequestException('Các khung giờ trong cùng một ngày không được chồng lên nhau');
    await this.db.transaction(async (tx) => {
      await tx.delete(expertAvailability).where(eq(expertAvailability.expertId, expertId));
      if (slots.length) await tx.insert(expertAvailability).values(slots.map((s) => ({ ...s, expertId })));
    });
    await this.audit.log({ actorId: expertId, action: 'availability.set', entity: 'user', entityId: expertId, ip });
    return this.getAvailability(expertId);
  }

  // ---------- Khung gio trong cho mot ca ----------

  private async expertForCase(user: AuthUser, caseId: string) {
    const c = await this.cases.assertAccess(user, caseId);
    if (!c.assignedExpertId || !CHAT_OPEN_STATUSES.includes(c.status)) {
      throw new ConflictException('Ca này chưa ở trạng thái có thể đặt lịch');
    }
    const [profile] = await this.db
      .select({ sessionMinutes: expertProfiles.sessionMinutes, modes: expertProfiles.modes })
      .from(expertProfiles)
      .where(eq(expertProfiles.userId, c.assignedExpertId))
      .limit(1);
    if (!profile) throw new NotFoundException('Không tìm thấy chuyên gia');
    return { case: c, expertId: c.assignedExpertId, ...profile };
  }

  private async freeSlots(expertId: string, sessionMinutes: number, days: number, now: Date) {
    const windows = await this.getAvailability(expertId);
    const busyRows = await this.db
      .select({ start: appointments.startsAt, end: appointments.endsAt })
      .from(appointments)
      .where(and(eq(appointments.expertId, expertId), inArray(appointments.status, [...ACTIVE]), gt(appointments.endsAt, now)));
    return computeSlots({ windows, sessionMinutes, busy: busyRows, now, days, minLeadMinutes: MIN_LEAD_MINUTES });
  }

  async slotsForCase(user: AuthUser, caseId: string, days: number) {
    const ctx = await this.expertForCase(user, caseId);
    const slots = await this.freeSlots(ctx.expertId, ctx.sessionMinutes, Math.min(Math.max(days, 1), MAX_DAYS), new Date());
    return { sessionMinutes: ctx.sessionMinutes, modes: ctx.modes, slots: slots.map((s) => s.toISOString()) };
  }

  // ---------- Dat / xac nhan / huy / hoan thanh ----------

  async book(user: AuthUser, caseId: string, input: BookAppointmentInput, ip?: string | null) {
    const ctx = await this.expertForCase(user, caseId);
    if (ctx.case.clientId !== user.id) throw new NotFoundException('Không tìm thấy yêu cầu');
    if (!ctx.modes.includes(input.mode)) throw new BadRequestException('Chuyên gia không nhận hình thức này');

    const startsAt = new Date(input.startsAt);
    const free = await this.freeSlots(ctx.expertId, ctx.sessionMinutes, MAX_DAYS, new Date());
    if (!free.some((s) => s.getTime() === startsAt.getTime())) {
      throw new ConflictException('Khung giờ này không còn trống. Vui lòng chọn giờ khác.');
    }
    const endsAt = new Date(startsAt.getTime() + ctx.sessionMinutes * 60_000);
    try {
      const [row] = await this.db
        .insert(appointments)
        .values({
          caseId,
          expertId: ctx.expertId,
          clientId: user.id,
          startsAt,
          endsAt,
          mode: input.mode,
          note: input.note ?? null,
        })
        .returning({ id: appointments.id });
      await this.audit.log({ actorId: user.id, action: 'appointment.book', entity: 'appointment', entityId: row!.id, ip });
      return { id: row!.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), status: 'requested' as const };
    } catch (e) {
      // Rang buoc EXCLUDE o DB la lop chong trung lich cuoi cung (hai nguoi dat cung luc).
      if (pgCode(e) === '23P01') throw new ConflictException('Khung giờ vừa được đặt. Vui lòng chọn giờ khác.');
      throw e;
    }
  }

  private async loadFor(user: AuthUser, id: string) {
    const [a] = await this.db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    const allowed = !!a && (user.role === 'admin' || a.clientId === user.id || a.expertId === user.id);
    if (!a || !allowed) throw new NotFoundException('Không tìm thấy lịch hẹn');
    return a;
  }

  async confirm(user: AuthUser, id: string, meetingLink: string | undefined, ip?: string | null) {
    const a = await this.loadFor(user, id);
    if (a.expertId !== user.id) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (a.status !== 'requested') throw new ConflictException('Lịch hẹn không ở trạng thái chờ xác nhận');
    await this.db
      .update(appointments)
      .set({ status: 'confirmed', meetingLink: meetingLink ?? a.meetingLink, updatedAt: new Date() })
      .where(eq(appointments.id, id));
    await this.audit.log({ actorId: user.id, action: 'appointment.confirm', entity: 'appointment', entityId: id, ip });
    return { id, status: 'confirmed' as const };
  }

  async cancel(user: AuthUser, id: string, ip?: string | null) {
    const a = await this.loadFor(user, id);
    if (!ACTIVE.includes(a.status as (typeof ACTIVE)[number])) throw new ConflictException('Không thể hủy lịch hẹn này');
    await this.db.update(appointments).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(appointments.id, id));
    await this.audit.log({ actorId: user.id, action: 'appointment.cancel', entity: 'appointment', entityId: id, ip });
    return { id, status: 'cancelled' as const };
  }

  async complete(user: AuthUser, id: string, ip?: string | null) {
    const a = await this.loadFor(user, id);
    if (a.expertId !== user.id) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (a.status !== 'confirmed') throw new ConflictException('Chỉ lịch hẹn đã xác nhận mới được đánh dấu hoàn thành');
    if (a.startsAt > new Date()) throw new ConflictException('Buổi hẹn chưa diễn ra');
    await this.db.update(appointments).set({ status: 'completed', updatedAt: new Date() }).where(eq(appointments.id, id));
    await this.audit.log({ actorId: user.id, action: 'appointment.complete', entity: 'appointment', entityId: id, ip });
    return { id, status: 'completed' as const };
  }

  // ---------- Danh sach ----------

  private async listWhere(where: ReturnType<typeof and>) {
    const clientU = alias(users, 'client_u');
    const expertU = alias(users, 'expert_u');
    const rows = await this.db
      .select({
        id: appointments.id,
        caseId: appointments.caseId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        mode: appointments.mode,
        meetingLink: appointments.meetingLink,
        note: appointments.note,
        clientId: appointments.clientId,
        clientName: clientU.fullName,
        expertId: appointments.expertId,
        expertName: expertU.fullName,
      })
      .from(appointments)
      .innerJoin(clientU, eq(clientU.id, appointments.clientId))
      .innerJoin(expertU, eq(expertU.id, appointments.expertId))
      .where(where)
      .orderBy(desc(appointments.startsAt))
      .limit(200);
    return rows;
  }

  /** Danh sach theo vai tro: khach thay lich cua minh, chuyen gia thay lich cua minh, admin thay tat ca. */
  async listFor(user: AuthUser) {
    if (user.role === 'admin') return this.listWhere(undefined);
    return this.listWhere(or(eq(appointments.clientId, user.id), eq(appointments.expertId, user.id)));
  }

  async listForCase(user: AuthUser, caseId: string) {
    await this.cases.assertAccess(user, caseId);
    return this.listWhere(eq(appointments.caseId, caseId));
  }
}
