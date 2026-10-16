import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import type { Db } from '../src/db/client.js';
import { DB } from '../src/db/db.module.js';
import { expertAvailability, expertProfiles } from '../src/db/schema.js';
import { type Agent, ORIGIN, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';
import { insertCompletedAppointment, linkExpert, seedScreening, submitCase, transition } from './fixtures.js';

describe('Danh gia chuyen gia va tim chuyen gia', () => {
  let app: NestExpressApplication;
  let questions: { id: string }[];

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
    questions = (await seedScreening(app)).questions;
  });

  const post = (a: Agent, url: string, body: object = {}) => a.post(url).set('Origin', ORIGIN).send(body);
  const patch = (a: Agent, url: string, body: object = {}) => a.patch(url).set('Origin', ORIGIN).send(body);
  const pub = (url: string) => request(app.getHttpServer()).get(url);

  async function withAppointment() {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    const expertUser = await createUser(app, 'expert', { fullName: 'Bac si An' });
    await linkExpert(app, expertUser.id, ['lo-au']);
    const clientUser = await createUser(app, 'client', { fullName: 'Nguyen Van Kin' });
    const client = await loginAs(app, clientUser);
    const caseId = (await submitCase(client, questions)).body.id as string;
    await transition(admin, caseId, { to: 'approved' });
    await transition(admin, caseId, { to: 'assigned', expertId: expertUser.id });
    const appointmentId = await insertCompletedAppointment(app, caseId, expertUser.id, clientUser.id);
    return { admin, expertUser, clientUser, client, expert: await loginAs(app, expertUser), caseId, appointmentId };
  }

  it('khach danh gia buoi da hoan thanh cua minh; moi buoi mot lan; cho duyet moi hien cong khai, khong lo ten khach', async () => {
    const s = await withAppointment();
    const url = `/api/appointments/${s.appointmentId}/review`;
    expect((await post(s.expert, url, { rating: 5 })).status).toBe(403);
    expect((await post(s.admin, url, { rating: 5 })).status).toBe(403);
    const stranger = await loginAs(app, await createUser(app, 'client'));
    expect((await post(stranger, url, { rating: 5 })).status).toBe(404);
    for (const bad of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: 5, comment: 'a'.repeat(1001) }, {}]) {
      expect((await post(s.client, url, bad)).status).toBe(400);
    }
    const ok = await post(s.client, url, { rating: 5, comment: 'Chuyen gia rat tan tam' });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('pending');
    expect((await post(s.client, url, { rating: 1 })).status).toBe(409);

    // Chua duyet: khong hien cong khai, khong tinh diem
    expect((await pub(`/api/experts/${s.expertUser.id}/reviews`)).body.reviews).toHaveLength(0);
    expect((await pub('/api/experts')).body.experts[0].rating).toBeNull();

    // Chi quan tri duyet
    const list = await s.admin.get('/api/admin/reviews?status=pending');
    expect(list.body.reviews).toHaveLength(1);
    expect(list.body.reviews[0].clientName).toBe('Nguyen Van Kin');
    for (const a of [s.client, s.expert]) expect((await a.get('/api/admin/reviews')).status).toBe(403);
    const id = list.body.reviews[0].id as string;
    expect((await patch(s.client, `/api/admin/reviews/${id}`, { status: 'published' })).status).toBe(403);
    expect((await patch(s.admin, `/api/admin/reviews/${id}`, { status: 'pending' })).status).toBe(400);
    expect((await patch(s.admin, `/api/admin/reviews/${id}`, { status: 'published' })).status).toBe(200);

    const open = await pub(`/api/experts/${s.expertUser.id}/reviews`);
    expect(open.body.reviews).toHaveLength(1);
    expect(JSON.stringify(open.body)).not.toContain('Nguyen'); // khong co ten khach
    expect(Object.keys(open.body.reviews[0]).sort()).toEqual(['comment', 'createdAt', 'id', 'rating']);
    expect((await pub('/api/experts')).body.experts[0].rating).toEqual({ avg: 5, count: 1 });
    expect((await s.expert.get('/api/notifications')).body.notifications.some((n: { type: string }) => n.type === 'review.published')).toBe(true);

    // An lai thi bien mat
    await patch(s.admin, `/api/admin/reviews/${id}`, { status: 'hidden' });
    expect((await pub(`/api/experts/${s.expertUser.id}/reviews`)).body.reviews).toHaveLength(0);
    expect((await s.client.get('/api/reviews/mine')).body.reviews[0].status).toBe('hidden');
  });

  it('chi danh gia duoc buoi da hoan thanh', async () => {
    const s = await withAppointment();
    const { appointments } = await import('../src/db/schema.js');
    await app.get<Db>(DB).update(appointments).set({ status: 'confirmed' }).where(eq(appointments.id, s.appointmentId));
    expect((await post(s.client, `/api/appointments/${s.appointmentId}/review`, { rating: 5 })).status).toBe(409);
  });

  it('tim chuyen gia: loc, sap xep, gio trong gan nhat, chuyen gia chua cong bo phi bi loai khi loc theo phi', async () => {
    const a = await createUser(app, 'expert', { fullName: 'An Nguyen' });
    const b = await createUser(app, 'expert', { fullName: 'Binh Tran' });
    const c = await createUser(app, 'expert', { fullName: 'Cuc Le' });
    await linkExpert(app, a.id, ['lo-au'], { feeVnd: 300_000, modes: ['online'], languages: ['vi'], bio: 'Chuyen ve lo au xa hoi' });
    await linkExpert(app, b.id, ['tram-cam'], { feeVnd: 600_000, modes: ['online', 'in_person'], languages: ['vi', 'en'] });
    await linkExpert(app, c.id, ['lo-au', 'tram-cam'], { feeVnd: null, modes: ['in_person'], languages: ['vi'] });
    const db = app.get<Db>(DB);
    // Chi B co lich ranh moi ngay trong tuan: B se co gio trong
    await db.insert(expertAvailability).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ expertId: b.id, weekday, startMinute: 0, endMinute: 1440 })));

    const names = async (qs: string) => ((await pub(`/api/experts${qs}`)).body.experts as { fullName: string }[]).map((e) => e.fullName);
    expect(await names('')).toEqual(['An Nguyen', 'Binh Tran', 'Cuc Le']);
    expect(await names('?specialty=lo-au')).toEqual(['An Nguyen', 'Cuc Le']);
    expect(await names('?mode=in_person')).toEqual(['Binh Tran', 'Cuc Le']);
    expect(await names('?language=en')).toEqual(['Binh Tran']);
    expect(await names('?q=xa%20hoi')).toEqual(['An Nguyen']);
    expect(await names('?maxFee=400000')).toEqual(['An Nguyen']); // C chua cong bo phi => loai
    expect(await names('?maxFee=600000')).toEqual(['An Nguyen', 'Binh Tran']);
    expect(await names('?specialty=khong-co')).toEqual([]);

    const all = (await pub('/api/experts?sort=soonest')).body.experts as { fullName: string; nextSlot: string | null }[];
    expect(all[0]!.fullName).toBe('Binh Tran'); // chi B co gio trong
    expect(all[0]!.nextSlot).toBeTruthy();
    expect(new Date(all[0]!.nextSlot!).getTime()).toBeGreaterThan(Date.now());
    expect(all[1]!.nextSlot).toBeNull();

    for (const bad of ['?sort=lung-tung', '?mode=xyz', '?maxFee=-5', '?maxFee=abc', `?q=${'a'.repeat(81)}`]) {
      expect((await pub(`/api/experts${bad}`)).status).toBe(400);
    }
    // Chuyen gia tam ngung khong xuat hien
    await db.update(expertProfiles).set({ active: false }).where(eq(expertProfiles.userId, a.id));
    expect(await names('')).toEqual(['Binh Tran', 'Cuc Le']);
  });

  it('sap xep theo danh gia dua tren diem da duyet', async () => {
    const s = await withAppointment();
    const other = await createUser(app, 'expert', { fullName: 'Chuyen gia khac' });
    await linkExpert(app, other.id, ['lo-au']);
    await post(s.client, `/api/appointments/${s.appointmentId}/review`, { rating: 4 });
    const id = (await s.admin.get('/api/admin/reviews')).body.reviews[0].id as string;
    await patch(s.admin, `/api/admin/reviews/${id}`, { status: 'published' });
    const names = ((await pub('/api/experts?sort=rating')).body.experts as { fullName: string }[]).map((e) => e.fullName);
    expect(names[0]).toBe('Bac si An');
  });
});
