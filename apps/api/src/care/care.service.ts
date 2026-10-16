import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AssessmentResultDto,
  type AuthUser,
  type HomeworkDto,
  type HomeworkInput,
  type HomeworkSubmitInput,
  type MoodEntryDto,
  type MoodInput,
  type SaveAssessmentInput,
  type SessionNoteDto,
  type SessionNoteInput,
  CHAT_OPEN_STATUSES,
  EXPERT_VISIBLE_STATUSES,
  scoreAssessment,
} from '@wtl/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { CasesService } from '../cases/cases.service.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { appointments, assessmentResults, homework, moodEntries, sessionNotes } from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const DAYS_90 = 90 * 24 * 3_600_000;

const noteDto = (r: typeof sessionNotes.$inferSelect): SessionNoteDto => ({
  id: r.id,
  caseId: r.caseId,
  appointmentId: r.appointmentId,
  body: r.body,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const moodDto = (r: typeof moodEntries.$inferSelect): MoodEntryDto => ({
  id: r.id,
  mood: r.mood,
  note: r.note,
  shared: r.shared,
  createdAt: r.createdAt.toISOString(),
});

const assessmentDto = (r: typeof assessmentResults.$inferSelect): AssessmentResultDto => {
  const kind = r.kind as AssessmentResultDto['kind'];
  const s = scoreAssessment(kind, r.answers);
  return { id: r.id, kind, shared: r.shared, createdAt: r.createdAt.toISOString(), ...s };
};

const homeworkDto = (r: typeof homework.$inferSelect): HomeworkDto => ({
  id: r.id,
  caseId: r.caseId,
  title: r.title,
  instructions: r.instructions,
  dueDate: r.dueDate,
  response: r.response,
  submittedAt: r.submittedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

/**
 * Noi dung rieng tu giua khach va chuyen gia (ghi chu, nhat ky, bai tap). Moi ham di qua `cases.assertParty`:
 * quan tri vien va nguoi khong thuoc ca luon nhan 404.
 */
@Injectable()
export class CareService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- Ghi chu buoi (chi tac gia doc) ----------

  async createNote(user: AuthUser, caseId: string, input: SessionNoteInput, ip?: string | null): Promise<SessionNoteDto> {
    await this.cases.assertParty(user, caseId, EXPERT_VISIBLE_STATUSES);
    if (input.appointmentId) {
      const [a] = await this.db
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(eq(appointments.id, input.appointmentId), eq(appointments.caseId, caseId), eq(appointments.expertId, user.id)))
        .limit(1);
      if (!a) throw new NotFoundException('Không tìm thấy lịch hẹn');
    }
    const [row] = await this.db
      .insert(sessionNotes)
      .values({ caseId, expertId: user.id, appointmentId: input.appointmentId ?? null, body: input.body })
      .returning();
    await this.audit.log({ actorId: user.id, action: 'note.create', entity: 'case', entityId: caseId, ip });
    return noteDto(row!);
  }

  async listNotes(user: AuthUser, caseId: string): Promise<SessionNoteDto[]> {
    await this.cases.assertParty(user, caseId, EXPERT_VISIBLE_STATUSES);
    const rows = await this.db
      .select()
      .from(sessionNotes)
      .where(and(eq(sessionNotes.caseId, caseId), eq(sessionNotes.expertId, user.id)))
      .orderBy(desc(sessionNotes.createdAt))
      .limit(200);
    return rows.map(noteDto);
  }

  async updateNote(user: AuthUser, id: string, body: string, ip?: string | null): Promise<SessionNoteDto> {
    const [row] = await this.db
      .update(sessionNotes)
      .set({ body, updatedAt: new Date() })
      .where(and(eq(sessionNotes.id, id), eq(sessionNotes.expertId, user.id)))
      .returning();
    if (!row) throw new NotFoundException('Không tìm thấy ghi chú');
    await this.audit.log({ actorId: user.id, action: 'note.update', entity: 'case', entityId: row.caseId, ip });
    return noteDto(row);
  }

  async deleteNote(user: AuthUser, id: string, ip?: string | null): Promise<void> {
    const rows = await this.db
      .delete(sessionNotes)
      .where(and(eq(sessionNotes.id, id), eq(sessionNotes.expertId, user.id)))
      .returning({ caseId: sessionNotes.caseId });
    if (rows.length === 0) throw new NotFoundException('Không tìm thấy ghi chú');
    await this.audit.log({ actorId: user.id, action: 'note.delete', entity: 'case', entityId: rows[0]!.caseId, ip });
  }

  // ---------- Nhat ky tam trang (khach) ----------

  async addMood(user: AuthUser, input: MoodInput): Promise<MoodEntryDto> {
    const [row] = await this.db
      .insert(moodEntries)
      .values({ userId: user.id, mood: input.mood, note: input.note || null, shared: input.shared })
      .returning();
    return moodDto(row!);
  }

  async listMood(user: AuthUser): Promise<MoodEntryDto[]> {
    const rows = await this.db
      .select()
      .from(moodEntries)
      .where(and(eq(moodEntries.userId, user.id), gt(moodEntries.createdAt, new Date(Date.now() - DAYS_90))))
      .orderBy(desc(moodEntries.createdAt))
      .limit(300);
    return rows.map(moodDto);
  }

  async setMoodShared(user: AuthUser, id: string, shared: boolean): Promise<MoodEntryDto> {
    const [row] = await this.db
      .update(moodEntries)
      .set({ shared })
      .where(and(eq(moodEntries.id, id), eq(moodEntries.userId, user.id)))
      .returning();
    if (!row) throw new NotFoundException('Không tìm thấy mục nhật ký');
    return moodDto(row);
  }

  async deleteMood(user: AuthUser, id: string): Promise<void> {
    const rows = await this.db
      .delete(moodEntries)
      .where(and(eq(moodEntries.id, id), eq(moodEntries.userId, user.id)))
      .returning({ id: moodEntries.id });
    if (rows.length === 0) throw new NotFoundException('Không tìm thấy mục nhật ký');
  }

  // ---------- Ket qua tu danh gia (khach) ----------

  async saveAssessment(user: AuthUser, input: SaveAssessmentInput): Promise<AssessmentResultDto> {
    const s = scoreAssessment(input.kind, input.answers); // diem do may chu tinh, khong nhan tu client
    const [row] = await this.db
      .insert(assessmentResults)
      .values({ userId: user.id, kind: input.kind, answers: input.answers, score: s.score, severity: s.severity, shared: input.shared })
      .returning();
    return assessmentDto(row!);
  }

  async listAssessments(user: AuthUser): Promise<AssessmentResultDto[]> {
    const rows = await this.db
      .select()
      .from(assessmentResults)
      .where(eq(assessmentResults.userId, user.id))
      .orderBy(desc(assessmentResults.createdAt))
      .limit(100);
    return rows.map(assessmentDto);
  }

  async setAssessmentShared(user: AuthUser, id: string, shared: boolean): Promise<AssessmentResultDto> {
    const [row] = await this.db
      .update(assessmentResults)
      .set({ shared })
      .where(and(eq(assessmentResults.id, id), eq(assessmentResults.userId, user.id)))
      .returning();
    if (!row) throw new NotFoundException('Không tìm thấy kết quả');
    return assessmentDto(row);
  }

  async deleteAssessment(user: AuthUser, id: string): Promise<void> {
    const rows = await this.db
      .delete(assessmentResults)
      .where(and(eq(assessmentResults.id, id), eq(assessmentResults.userId, user.id)))
      .returning({ id: assessmentResults.id });
    if (rows.length === 0) throw new NotFoundException('Không tìm thấy kết quả');
  }

  /**
   * Chuyen gia xem phan khach CHU DONG chia se (nhat ky, ket qua tu danh gia), chi khi la chuyen gia dang phu trach
   * mot ca dang mo cua khach nay. Moi lan xem duoc ghi nhat ky.
   */
  async clientTracking(user: AuthUser, caseId: string, ip?: string | null) {
    const c = await this.cases.assertParty(user, caseId, CHAT_OPEN_STATUSES);
    if (user.role !== 'expert') throw new NotFoundException('Không tìm thấy yêu cầu');
    const since = new Date(Date.now() - DAYS_90);
    const mood = await this.db
      .select()
      .from(moodEntries)
      .where(and(eq(moodEntries.userId, c.clientId), eq(moodEntries.shared, true), gt(moodEntries.createdAt, since)))
      .orderBy(desc(moodEntries.createdAt))
      .limit(300);
    const results = await this.db
      .select()
      .from(assessmentResults)
      .where(and(eq(assessmentResults.userId, c.clientId), eq(assessmentResults.shared, true)))
      .orderBy(desc(assessmentResults.createdAt))
      .limit(50);
    await this.audit.log({ actorId: user.id, action: 'tracking.view', entity: 'case', entityId: caseId, ip });
    return { mood: mood.map(moodDto), assessments: results.map(assessmentDto) };
  }

  // ---------- Bai tap giua cac buoi ----------

  async createHomework(user: AuthUser, caseId: string, input: HomeworkInput, ip?: string | null): Promise<HomeworkDto> {
    const c = await this.cases.assertParty(user, caseId, CHAT_OPEN_STATUSES);
    if (user.role !== 'expert') throw new NotFoundException('Không tìm thấy yêu cầu');
    const [row] = await this.db
      .insert(homework)
      .values({
        caseId,
        expertId: user.id,
        clientId: c.clientId,
        title: input.title,
        instructions: input.instructions,
        dueDate: input.dueDate ?? null,
      })
      .returning();
    await this.audit.log({ actorId: user.id, action: 'homework.create', entity: 'case', entityId: caseId, ip });
    await this.notifications.notify(c.clientId, 'homework.assigned', `Bài tập mới: ${input.title}`, `/me/cases/${caseId}`);
    return homeworkDto(row!);
  }

  async listHomework(user: AuthUser, caseId: string): Promise<HomeworkDto[]> {
    await this.cases.assertParty(user, caseId, EXPERT_VISIBLE_STATUSES);
    const rows = await this.db.select().from(homework).where(eq(homework.caseId, caseId)).orderBy(desc(homework.createdAt)).limit(200);
    return rows.map(homeworkDto);
  }

  async submitHomework(user: AuthUser, id: string, input: HomeworkSubmitInput, ip?: string | null): Promise<HomeworkDto> {
    const [h] = await this.db.select().from(homework).where(and(eq(homework.id, id), eq(homework.clientId, user.id))).limit(1);
    if (!h) throw new NotFoundException('Không tìm thấy bài tập');
    await this.cases.assertParty(user, h.caseId); // van phai la khach cua ca
    if (h.submittedAt) throw new ConflictException('Bài tập này đã được nộp');
    const [row] = await this.db
      .update(homework)
      .set({ response: input.response, submittedAt: new Date() })
      .where(eq(homework.id, id))
      .returning();
    await this.audit.log({ actorId: user.id, action: 'homework.submit', entity: 'case', entityId: h.caseId, ip });
    await this.notifications.notify(h.expertId, 'homework.submitted', `Khách đã nộp bài tập: ${h.title}`, `/expert/cases/${h.caseId}`);
    return homeworkDto(row!);
  }
}
