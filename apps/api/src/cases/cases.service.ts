import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AnswerSnapshot,
  type AuthUser,
  type CaseStatus,
  type RiskLevel,
  type SubmitScreeningInput,
  type TransitionInput,
  EXPERT_VISIBLE_STATUSES,
  OPEN_CASE_STATUSES,
  canTransition,
  transitionExists,
} from '@wtl/shared';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { env } from '../config/env.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { caseEvents, cases, expertProfiles, users } from '../db/schema.js';
import { ExpertsService } from '../experts/experts.service.js';
import { evaluateAnswers } from './evaluate-answers.js';
import { ScreeningService } from './screening.service.js';

type CaseRow = typeof cases.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const riskOrder = sql`case ${cases.riskLevel} when 'urgent' then 0 when 'elevated' then 1 else 2 end`;

/** Cac truong khach duoc phep thay trong cau tra loi cua chinh minh (khong co co nguy co / goi y chuyen mon). */
const clientAnswers = (a: AnswerSnapshot[]) =>
  a.map(({ questionId, prompt, type, labels, text }) => ({ questionId, prompt, type, labels, text }));

@Injectable()
export class CasesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly screening: ScreeningService,
    private readonly experts: ExpertsService,
  ) {}

  hotlines() {
    return env.hotlines;
  }

  // ---------- Khach gui bai sang loc ----------

  async submit(user: AuthUser, input: SubmitScreeningInput, ip?: string | null) {
    const [open] = await this.db
      .select({ id: cases.id })
      .from(cases)
      .where(and(eq(cases.clientId, user.id), inArray(cases.status, [...OPEN_CASE_STATUSES])))
      .limit(1);
    if (open) throw new ConflictException('Bạn đang có một yêu cầu chưa hoàn tất. Vui lòng chờ trung tâm liên hệ.');

    const questions = await this.screening.activeQuestions();
    const { snapshot, riskLevel } = evaluateAnswers(questions, input);

    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(cases)
        .values({
          clientId: user.id,
          riskLevel,
          answers: snapshot,
          concerns: input.concerns,
          preferredMode: input.preferredMode,
        })
        .returning({ id: cases.id });
      await tx.insert(caseEvents).values({ caseId: row!.id, actorId: user.id, fromStatus: null, toStatus: 'submitted' });
      return row!.id;
    });
    await this.audit.log({
      actorId: user.id,
      action: 'case.submit',
      entity: 'case',
      entityId: id,
      ip,
      meta: { riskLevel },
    });
    // Nguy co cao: tra ve hotline ngay de hien cho khach.
    return { id, status: 'submitted' as CaseStatus, riskLevel, hotlines: riskLevel === 'none' ? [] : this.hotlines() };
  }

  // ---------- Truy van theo vai tro ----------

  async listMine(user: AuthUser) {
    const rows = await this.db
      .select({
        id: cases.id,
        status: cases.status,
        riskLevel: cases.riskLevel,
        createdAt: cases.createdAt,
        rejectionReason: cases.rejectionReason,
        expertId: cases.assignedExpertId,
        expertName: users.fullName,
        expertHeadline: expertProfiles.headline,
        expertAvatar: expertProfiles.avatarUrl,
      })
      .from(cases)
      .leftJoin(users, eq(users.id, cases.assignedExpertId))
      .leftJoin(expertProfiles, eq(expertProfiles.userId, cases.assignedExpertId))
      .where(eq(cases.clientId, user.id))
      .orderBy(desc(cases.createdAt));
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      riskLevel: r.riskLevel,
      createdAt: r.createdAt,
      rejectionReason: r.status === 'rejected' ? r.rejectionReason : null,
      // Khach chi thay chuyen gia sau khi da duoc phan.
      expert:
        r.expertId && EXPERT_VISIBLE_STATUSES.includes(r.status)
          ? { id: r.expertId, fullName: r.expertName, headline: r.expertHeadline, avatarUrl: r.expertAvatar }
          : null,
    }));
  }

  async listForExpert(user: AuthUser) {
    return this.db
      .select({
        id: cases.id,
        status: cases.status,
        riskLevel: cases.riskLevel,
        assignedAt: cases.assignedAt,
        clientName: users.fullName,
      })
      .from(cases)
      .innerJoin(users, eq(users.id, cases.clientId))
      .where(and(eq(cases.assignedExpertId, user.id), inArray(cases.status, [...EXPERT_VISIBLE_STATUSES])))
      .orderBy(riskOrder, desc(cases.assignedAt));
  }

  async listForAdmin(filter: { status?: CaseStatus; riskLevel?: RiskLevel }) {
    const conds = [];
    if (filter.status) conds.push(eq(cases.status, filter.status));
    if (filter.riskLevel) conds.push(eq(cases.riskLevel, filter.riskLevel));
    return this.db
      .select({
        id: cases.id,
        status: cases.status,
        riskLevel: cases.riskLevel,
        createdAt: cases.createdAt,
        clientName: users.fullName,
        assignedExpertId: cases.assignedExpertId,
      })
      .from(cases)
      .innerJoin(users, eq(users.id, cases.clientId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(riskOrder, cases.createdAt)
      .limit(500);
  }

  /**
   * Quy tac truy cap theo doi tuong. Tra 404 (khong phai 403) de khong lo su ton tai cua ca.
   * - admin: moi ca. - khach: chi ca cua minh. - chuyen gia: chi ca duoc phan cho minh va da o trang thai nhin thay duoc.
   */
  private async loadAccessible(tx: Db | Tx, user: AuthUser, id: string, lock = false): Promise<CaseRow> {
    const base = tx.select().from(cases).where(eq(cases.id, id)).limit(1);
    const [c] = lock ? await base.for('update') : await base;
    const allowed =
      !!c &&
      (user.role === 'admin' ||
        (user.role === 'client' && c.clientId === user.id) ||
        (user.role === 'expert' && c.assignedExpertId === user.id && EXPERT_VISIBLE_STATUSES.includes(c.status)));
    if (!c || !allowed) throw new NotFoundException('Không tìm thấy yêu cầu');
    return c;
  }

  /** Kiem tra quyen truy cap ca cho cac module khac (lich hen, chat). */
  async assertAccess(user: AuthUser, id: string): Promise<CaseRow> {
    return this.loadAccessible(this.db, user, id);
  }

  async getDetail(user: AuthUser, id: string, ip?: string | null) {
    const c = await this.loadAccessible(this.db, user, id);
    const [client] = await this.db
      .select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, c.clientId))
      .limit(1);
    const events = await this.db.select().from(caseEvents).where(eq(caseEvents.caseId, c.id)).orderBy(caseEvents.createdAt);
    const answers = c.answers as AnswerSnapshot[];
    const expert =
      c.assignedExpertId && EXPERT_VISIBLE_STATUSES.includes(c.status)
        ? await this.experts.getPublic(c.assignedExpertId).catch(() => null)
        : null;

    if (user.role === 'client') {
      return {
        id: c.id,
        status: c.status,
        riskLevel: c.riskLevel,
        createdAt: c.createdAt,
        concerns: c.concerns,
        preferredMode: c.preferredMode,
        rejectionReason: c.status === 'rejected' ? c.rejectionReason : null,
        answers: clientAnswers(answers),
        expert,
        events: events.map((e) => ({ toStatus: e.toStatus, createdAt: e.createdAt })),
        hotlines: c.riskLevel === 'none' ? [] : this.hotlines(),
      };
    }

    // Chuyen gia va admin xem thong tin lien he khach: luon ghi audit.
    await this.audit.log({ actorId: user.id, action: 'case.read', entity: 'case', entityId: c.id, ip });
    const detail = {
      id: c.id,
      status: c.status,
      riskLevel: c.riskLevel,
      createdAt: c.createdAt,
      concerns: c.concerns,
      preferredMode: c.preferredMode,
      answers,
      client,
      expert,
      events: events.map((e) => ({ actorId: e.actorId, fromStatus: e.fromStatus, toStatus: e.toStatus, note: e.note, createdAt: e.createdAt })),
    };
    if (user.role === 'expert') return detail;
    return {
      ...detail,
      adminNote: c.adminNote,
      rejectionReason: c.rejectionReason,
      assignedExpertId: c.assignedExpertId,
      suggestions: c.status === 'approved' || c.status === 'assigned' ? await this.suggestExperts(answers, c.preferredMode) : [],
    };
  }

  /** Goi y chuyen gia: diem = so lan linh vuc khop voi dap an da chon, cong/tru theo hinh thuc mong muon. */
  private async suggestExperts(answers: AnswerSnapshot[], preferredMode: string | null) {
    const wanted = new Map<string, number>();
    for (const a of answers) for (const s of a.specialties) wanted.set(s, (wanted.get(s) ?? 0) + 1);
    const experts = await this.experts.listPublic();
    return experts
      .map((e) => {
        const matched = e.specialties.filter((s) => wanted.has(s.slug));
        let score = matched.reduce((sum, s) => sum + 10 * (wanted.get(s.slug) ?? 0), 0);
        const reasons = matched.map((s) => `Chuyên môn: ${s.name}`);
        if (preferredMode && preferredMode !== 'any') {
          if (e.modes.includes(preferredMode)) {
            score += 3;
            reasons.push('Đúng hình thức mong muốn');
          } else score -= 5;
        }
        return { expertId: e.id, fullName: e.fullName, headline: e.headline, score, reasons };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  // ---------- Chuyen trang thai ----------

  async transition(user: AuthUser, id: string, input: TransitionInput, ip?: string | null) {
    const result = await this.db.transaction(async (tx) => {
      const c = await this.loadAccessible(tx, user, id, true);
      const { to } = input;
      if (!transitionExists(c.status, to)) {
        throw new ConflictException('Không thể chuyển trạng thái này từ trạng thái hiện tại');
      }
      if (!canTransition(c.status, to, user.role)) throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');

      const now = new Date();
      const patch: Partial<typeof cases.$inferInsert> = { status: to, updatedAt: now };
      const note = input.note?.trim() || undefined;

      if (to === 'approved') {
        if (c.status === 'submitted') patch.approvedAt = now;
        else {
          // Chuyen gia tu choi hoac admin thu hoi phan cong: ca quay lai hang cho.
          if (!note) throw new BadRequestException('Vui lòng nêu lý do');
          patch.assignedExpertId = null;
          patch.assignedAt = null;
        }
      } else if (to === 'rejected') {
        if (!note) throw new BadRequestException('Vui lòng nêu lý do để gửi lại cho khách');
        patch.rejectionReason = note;
      } else if (to === 'assigned') {
        if (!input.expertId || !(await this.experts.isActiveExpert(input.expertId))) {
          throw new BadRequestException('Chuyên gia không hợp lệ hoặc đang tạm ngưng');
        }
        patch.assignedExpertId = input.expertId;
        patch.assignedAt = now;
      } else if (to === 'closed') {
        patch.closedAt = now;
      }

      await tx.update(cases).set(patch).where(eq(cases.id, c.id));
      await tx.insert(caseEvents).values({ caseId: c.id, actorId: user.id, fromStatus: c.status, toStatus: to, note: note ?? null });
      return { from: c.status, to, expertId: input.expertId };
    });
    await this.audit.log({
      actorId: user.id,
      action: 'case.transition',
      entity: 'case',
      entityId: id,
      ip,
      meta: { from: result.from, to: result.to, ...(result.expertId ? { expertId: result.expertId } : {}) },
    });
    return { id, status: result.to };
  }

  async setAdminNote(user: AuthUser, id: string, note: string, ip?: string | null) {
    await this.loadAccessible(this.db, user, id);
    await this.db.update(cases).set({ adminNote: note, updatedAt: new Date() }).where(eq(cases.id, id));
    await this.audit.log({ actorId: user.id, action: 'case.note', entity: 'case', entityId: id, ip });
    return { ok: true };
  }
}
