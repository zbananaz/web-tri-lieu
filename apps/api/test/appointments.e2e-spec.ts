import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import type { Db } from '../src/db/client.js';
import { DB } from '../src/db/db.module.js';
import { appointments, auditLogs } from '../src/db/schema.js';
import { ORIGIN, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';
import { linkExpert, seedScreening, submitCase, transition } from './fixtures.js';

const WEEK = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 8 * 60, endMinute: 17 * 60 }));

describe('Gio ranh va dat lich', () => {
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

  async function setup() {
    const admin = await createUser(app, 'admin');
    const expert = await createUser(app, 'expert');
    await linkExpert(app, expert.id, ['lo-au']);
    const clientUser = await createUser(app, 'client');
    const s = {
      admin,
      expert,
      clientUser,
      adminAgent: await loginAs(app, admin),
      expertAgent: await loginAs(app, expert),
      client: await loginAs(app, clientUser),
    };
    const res = await submitCase(s.client, questions);
    const caseId = res.body.id as string;
    await transition(s.adminAgent, caseId, { to: 'approved' });
    await transition(s.adminAgent, caseId, { to: 'assigned', expertId: expert.id });
    return { ...s, caseId };
  }

  const setAvail = (agent: Awaited<ReturnType<typeof loginAs>>, slots: object[]) =>
    agent.put('/api/experts/me/availability').set('Origin', ORIGIN).send({ slots });

  async function firstSlot(s: Awaited<ReturnType<typeof setup>>) {
    const res = await s.client.get(`/api/cases/${s.caseId}/slots`);
    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBeGreaterThan(0);
    return res.body.slots[0] as string;
  }

  const book = (agent: Awaited<ReturnType<typeof loginAs>>, caseId: string, startsAt: string, extra: object = {}) =>
    agent.post(`/api/cases/${caseId}/appointments`).set('Origin', ORIGIN).send({ startsAt, mode: 'online', ...extra });

  describe('gio ranh', () => {
    it('chi chuyen gia moi dat duoc gio ranh cua minh', async () => {
      const s = await setup();
      expect((await setAvail(s.expertAgent, WEEK)).status).toBe(200);
      expect((await s.expertAgent.get('/api/experts/me/availability')).body.slots).toHaveLength(7);
      expect((await setAvail(s.client, WEEK)).status).toBe(403);
      expect((await setAvail(s.adminAgent, WEEK)).status).toBe(403);
      expect((await request(app.getHttpServer()).put('/api/experts/me/availability').set('Origin', ORIGIN).send({ slots: [] })).status).toBe(401);
    });

    it('tu choi khung gio sai hoac chong len nhau', async () => {
      const s = await setup();
      expect((await setAvail(s.expertAgent, [{ weekday: 1, startMinute: 600, endMinute: 540 }])).status).toBe(400);
      expect((await setAvail(s.expertAgent, [{ weekday: 9, startMinute: 0, endMinute: 60 }])).status).toBe(400);
      const overlap = [
        { weekday: 1, startMinute: 480, endMinute: 720 },
        { weekday: 1, startMinute: 660, endMinute: 900 },
      ];
      expect((await setAvail(s.expertAgent, overlap)).status).toBe(400);
    });
  });

  describe('dat lich', () => {
    it('khach thay khung gio trong, dat lich thanh cong va chuyen gia xac nhan', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      const slot = await firstSlot(s);
      const booked = await book(s.client, s.caseId, slot, { note: 'Ghi chu' });
      expect(booked.status).toBe(201);
      expect(booked.body.status).toBe('requested');

      // Khung gio da dat khong con trong nua
      const again = await s.client.get(`/api/cases/${s.caseId}/slots`);
      expect(again.body.slots).not.toContain(slot);

      const confirm = await s.expertAgent
        .post(`/api/appointments/${booked.body.id}/confirm`)
        .set('Origin', ORIGIN)
        .send({ meetingLink: 'https://meet.example.com/abc' });
      expect(confirm.status).toBe(200);
      const list = await s.client.get('/api/appointments');
      expect(list.body.appointments[0]).toMatchObject({ status: 'confirmed', meetingLink: 'https://meet.example.com/abc' });
    });

    it('khong dat duoc khung gio khong nam trong gio ranh hoac qua gan', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      const slot = await firstSlot(s);
      const odd = new Date(new Date(slot).getTime() + 7 * 60_000).toISOString(); // lech khoi luoi
      expect((await book(s.client, s.caseId, odd)).status).toBe(409);
      const soon = new Date(Date.now() + 30 * 60_000).toISOString();
      expect((await book(s.client, s.caseId, soon)).status).toBe(409);
      const past = new Date(Date.now() - 86_400_000).toISOString();
      expect((await book(s.client, s.caseId, past)).status).toBe(409);
    });

    it('hai nguoi dat cung luc: chi mot nguoi thanh cong (rang buoc DB)', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      const slot = await firstSlot(s);
      // Khach thu hai cung chuyen gia
      const client2 = await createUser(app, 'client');
      const c2 = await loginAs(app, client2);
      const res2 = await submitCase(c2, questions);
      await transition(s.adminAgent, res2.body.id, { to: 'approved' });
      await transition(s.adminAgent, res2.body.id, { to: 'assigned', expertId: s.expert.id });

      const results = await Promise.all([book(s.client, s.caseId, slot), book(c2, res2.body.id, slot)]);
      const codes = results.map((r) => r.status).sort();
      expect(codes).toEqual([201, 409]);
      const db = app.get<Db>(DB);
      expect(await db.select().from(appointments)).toHaveLength(1);
    });

    it('rang buoc DB tu choi chong lich ke ca khi bo qua lop dich vu', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      const slot = await firstSlot(s);
      expect((await book(s.client, s.caseId, slot)).status).toBe(201);
      const db = app.get<Db>(DB);
      const [a] = await db.select().from(appointments);
      await expect(
        db.insert(appointments).values({
          caseId: a!.caseId,
          expertId: a!.expertId,
          clientId: a!.clientId,
          startsAt: new Date(a!.startsAt.getTime() + 10 * 60_000),
          endsAt: new Date(a!.endsAt.getTime() + 10 * 60_000),
          mode: 'online',
        }),
      ).rejects.toThrow();
    });

    it('huy lich giai phong khung gio', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      const slot = await firstSlot(s);
      const booked = await book(s.client, s.caseId, slot);
      expect((await s.client.post(`/api/appointments/${booked.body.id}/cancel`).set('Origin', ORIGIN).send({})).status).toBe(200);
      expect((await s.client.get(`/api/cases/${s.caseId}/slots`)).body.slots).toContain(slot);
      // Huy hai lan -> 409
      expect((await s.client.post(`/api/appointments/${booked.body.id}/cancel`).set('Origin', ORIGIN).send({})).status).toBe(409);
      expect((await book(s.client, s.caseId, slot)).status).toBe(201);
    });

    it('chi khach cua ca moi dat duoc; ca chua phan cong thi khong dat duoc', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      const slot = await firstSlot(s);
      expect((await book(s.expertAgent, s.caseId, slot)).status).toBe(403);
      expect((await book(s.adminAgent, s.caseId, slot)).status).toBe(403);
      const other = await loginAs(app, await createUser(app, 'client'));
      expect((await book(other, s.caseId, slot)).status).toBe(404);

      const fresh = await submitCase(other, questions);
      expect((await book(other, fresh.body.id, slot)).status).toBe(409);
    });

    it('hinh thuc khong hop le bi tu choi', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      const slot = await firstSlot(s);
      expect((await book(s.client, s.caseId, slot, { mode: 'telepathy' })).status).toBe(400);
    });
  });

  describe('phan quyen theo doi tuong', () => {
    it('xac nhan/hoan thanh chi danh cho dung chuyen gia; nguoi la thay 404', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      const booked = await book(s.client, s.caseId, await firstSlot(s));
      const id = booked.body.id as string;
      const url = `/api/appointments/${id}/confirm`;
      expect((await s.client.post(url).set('Origin', ORIGIN).send({})).status).toBe(403);
      expect((await s.adminAgent.post(url).set('Origin', ORIGIN).send({})).status).toBe(403);

      const otherExpert = await createUser(app, 'expert');
      await linkExpert(app, otherExpert.id, ['lo-au']);
      const oe = await loginAs(app, otherExpert);
      expect((await oe.post(url).set('Origin', ORIGIN).send({})).status).toBe(404);
      expect((await oe.post(`/api/appointments/${id}/cancel`).set('Origin', ORIGIN).send({})).status).toBe(404);

      // Link phong hop nguy hiem bi chan
      const bad = await s.expertAgent.post(url).set('Origin', ORIGIN).send({ meetingLink: 'javascript:alert(1)' });
      expect(bad.status).toBe(400);
      expect((await s.expertAgent.post(url).set('Origin', ORIGIN).send({})).status).toBe(200);
      expect((await s.expertAgent.post(url).set('Origin', ORIGIN).send({})).status).toBe(409);
      // Chua den gio nen chua danh dau hoan thanh duoc
      expect((await s.expertAgent.post(`/api/appointments/${id}/complete`).set('Origin', ORIGIN).send({})).status).toBe(409);
    });

    it('danh sach lich chi hien thi lich cua chinh minh; admin thay tat ca', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      await book(s.client, s.caseId, await firstSlot(s));
      const stranger = await loginAs(app, await createUser(app, 'client'));
      expect((await stranger.get('/api/appointments')).body.appointments).toHaveLength(0);
      expect((await stranger.get(`/api/cases/${s.caseId}/appointments`)).status).toBe(404);
      expect((await s.client.get('/api/appointments')).body.appointments).toHaveLength(1);
      expect((await s.expertAgent.get('/api/appointments')).body.appointments).toHaveLength(1);
      expect((await s.adminAgent.get('/api/appointments')).body.appointments).toHaveLength(1);
      expect((await request(app.getHttpServer()).get('/api/appointments')).status).toBe(401);
    });

    it('ghi nhat ky kiem toan cho dat/xac nhan/huy', async () => {
      const s = await setup();
      await setAvail(s.expertAgent, WEEK);
      const booked = await book(s.client, s.caseId, await firstSlot(s));
      await s.expertAgent.post(`/api/appointments/${booked.body.id}/confirm`).set('Origin', ORIGIN).send({});
      await s.client.post(`/api/appointments/${booked.body.id}/cancel`).set('Origin', ORIGIN).send({});
      const db = app.get<Db>(DB);
      const rows = await db.select({ action: auditLogs.action }).from(auditLogs).where(eq(auditLogs.entity, 'appointment'));
      expect(rows.map((r) => r.action).sort()).toEqual(['appointment.book', 'appointment.cancel', 'appointment.confirm']);
    });
  });
});
