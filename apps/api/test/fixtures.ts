import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import type { Db } from '../src/db/client.js';
import { DB } from '../src/db/db.module.js';
import { expertProfiles, expertSpecialties, screeningQuestions, specialties } from '../src/db/schema.js';
import type { Response } from 'supertest';
import { type Agent, ORIGIN, request } from './helpers.js';

export async function seedScreening(app: NestExpressApplication) {
  const db = app.get<Db>(DB);
  const specs = await db
    .insert(specialties)
    .values([
      { slug: 'lo-au', name: 'Lo âu' },
      { slug: 'tram-cam', name: 'Trầm cảm' },
    ])
    .returning();
  await db.insert(screeningQuestions).values([
    {
      position: 1,
      prompt: 'Gần đây bạn cảm thấy thế nào?',
      type: 'single',
      required: true,
      options: [
        { value: 'tot', label: 'Khá ổn' },
        { value: 'lo-au', label: 'Hay lo lắng', specialties: ['lo-au'] },
        { value: 'buon', label: 'Buồn chán kéo dài', specialties: ['tram-cam'] },
      ],
    },
    {
      position: 2,
      prompt: 'Bạn có ý nghĩ làm hại bản thân không?',
      type: 'single',
      required: true,
      options: [
        { value: 'khong', label: 'Không' },
        { value: 'thinh-thoang', label: 'Thỉnh thoảng', risk: 'elevated' },
        { value: 'thuong-xuyen', label: 'Thường xuyên', risk: 'urgent' },
      ],
    },
    { position: 3, prompt: 'Bạn muốn chia sẻ thêm điều gì?', type: 'text', required: false, options: [] },
  ]);
  const questions = await db.select().from(screeningQuestions).orderBy(screeningQuestions.position);
  return { specialties: specs, questions };
}

export async function linkExpert(app: NestExpressApplication, expertId: string, slugs: string[], overrides: object = {}) {
  const db = app.get<Db>(DB);
  await db.insert(expertProfiles).values({ userId: expertId, headline: 'Chuyên gia trị liệu', ...overrides }).onConflictDoNothing();
  for (const slug of slugs) {
    const [s] = await db.select().from(specialties).where(eq(specialties.slug, slug));
    await db.insert(expertSpecialties).values({ expertId, specialtyId: s!.id });
  }
}

export interface AnswerChoice {
  mood?: string;
  risk?: string;
}

/** Khach gui bai sang loc qua API that. */
export async function submitCase(agent: Agent, questions: { id: string }[], choice: AnswerChoice = {}, extra: object = {}): Promise<Response> {
  return agent
    .post('/api/cases')
    .set('Origin', ORIGIN)
    .send({
      answers: [
        { questionId: questions[0]!.id, value: choice.mood ?? 'lo-au' },
        { questionId: questions[1]!.id, value: choice.risk ?? 'khong' },
      ],
      concerns: 'Em hay mất ngủ',
      preferredMode: 'online',
      ...extra,
    });
}

export const transition = (agent: Agent, caseId: string, body: object): Promise<Response> =>
  agent.post(`/api/cases/${caseId}/transition`).set('Origin', ORIGIN).send(body);

export { request };
