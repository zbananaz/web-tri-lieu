import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PublicQuestion, QuestionInput, QuestionOption } from '@wtl/shared';
import { asc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { screeningQuestions } from '../db/schema.js';

export type QuestionRow = Omit<typeof screeningQuestions.$inferSelect, 'options'> & { options: QuestionOption[] };

@Injectable()
export class ScreeningService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async activeQuestions(): Promise<QuestionRow[]> {
    const rows = await this.db
      .select()
      .from(screeningQuestions)
      .where(eq(screeningQuestions.active, true))
      .orderBy(asc(screeningQuestions.position));
    return rows as QuestionRow[];
  }

  /** Cho khach: bo co nguy co va goi y chuyen mon de khong dinh huong cau tra loi. */
  async publicQuestions(): Promise<PublicQuestion[]> {
    return (await this.activeQuestions()).map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      helpText: q.helpText,
      type: q.type,
      required: q.required,
      options: q.options.map((o) => ({ value: o.value, label: o.label })),
    }));
  }

  async adminList(): Promise<QuestionRow[]> {
    const rows = await this.db.select().from(screeningQuestions).orderBy(asc(screeningQuestions.position));
    return rows as QuestionRow[];
  }

  async create(input: QuestionInput, actorId: string, ip?: string | null) {
    const [row] = await this.db
      .insert(screeningQuestions)
      .values({ ...input, helpText: input.helpText ?? null })
      .returning({ id: screeningQuestions.id });
    await this.audit.log({ actorId, action: 'screening.question_create', entity: 'screening_question', entityId: row!.id, ip });
    return { id: row!.id };
  }

  async update(id: string, input: QuestionInput, actorId: string, ip?: string | null) {
    const res = await this.db
      .update(screeningQuestions)
      .set({ ...input, helpText: input.helpText ?? null, updatedAt: new Date() })
      .where(eq(screeningQuestions.id, id))
      .returning({ id: screeningQuestions.id });
    if (res.length === 0) throw new NotFoundException('Không tìm thấy câu hỏi');
    await this.audit.log({ actorId, action: 'screening.question_update', entity: 'screening_question', entityId: id, ip });
    return { ok: true };
  }
}
