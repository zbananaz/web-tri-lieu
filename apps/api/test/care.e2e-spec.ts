import type { NestExpressApplication } from '@nestjs/platform-express';
import { type Agent, ORIGIN, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';
import { linkExpert, seedScreening, submitCase, transition } from './fixtures.js';

describe('Noi dung rieng tu giua khach va chuyen gia (ghi chu, nhat ky, bai tap) + thong bao', () => {
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
    const adminUser = await createUser(app, 'admin');
    const expertUser = await createUser(app, 'expert');
    await linkExpert(app, expertUser.id, ['lo-au']);
    const clientUser = await createUser(app, 'client');
    const s = {
      adminUser,
      expertUser,
      clientUser,
      admin: await loginAs(app, adminUser),
      expert: await loginAs(app, expertUser),
      client: await loginAs(app, clientUser),
    };
    const res = await submitCase(s.client, questions);
    return { ...s, caseId: res.body.id as string };
  }
  type S = Awaited<ReturnType<typeof setup>>;
  const assign = async (s: S) => {
    await transition(s.admin, s.caseId, { to: 'approved' });
    await transition(s.admin, s.caseId, { to: 'assigned', expertId: s.expertUser.id });
  };
  const post = (a: Agent, url: string, body: object = {}) => a.post(url).set('Origin', ORIGIN).send(body);
  const patch = (a: Agent, url: string, body: object = {}) => a.patch(url).set('Origin', ORIGIN).send(body);
  const del = (a: Agent, url: string) => a.delete(url).set('Origin', ORIGIN);

  it('ghi chu buoi: chi chuyen gia tac gia doc; khach, quan tri vien, chuyen gia khac deu khong thay', async () => {
    const s = await setup();
    await assign(s);
    const other = await createUser(app, 'expert');
    await linkExpert(app, other.id, ['lo-au']);
    const otherExpert = await loginAs(app, other);

    expect((await post(s.client, `/api/cases/${s.caseId}/notes`, { body: 'x' })).status).toBe(403);
    expect((await post(s.admin, `/api/cases/${s.caseId}/notes`, { body: 'x' })).status).toBe(403);
    expect((await post(otherExpert, `/api/cases/${s.caseId}/notes`, { body: 'x' })).status).toBe(404);
    expect((await post(s.expert, `/api/cases/${s.caseId}/notes`, { body: '   ' })).status).toBe(400);

    const created = await post(s.expert, `/api/cases/${s.caseId}/notes`, { body: 'Khach co dau hieu lo au khi di lam' });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    expect((await s.expert.get(`/api/cases/${s.caseId}/notes`)).body.notes).toHaveLength(1);
    for (const a of [s.client, s.admin]) expect((await a.get(`/api/cases/${s.caseId}/notes`)).status).toBe(403);
    expect((await otherExpert.get(`/api/cases/${s.caseId}/notes`)).status).toBe(404);
    expect((await request(app.getHttpServer()).get(`/api/cases/${s.caseId}/notes`)).status).toBe(401);

    // Chuyen gia khac khong sua/xoa duoc
    expect((await patch(otherExpert, `/api/notes/${id}`, { body: 'hack' })).status).toBe(404);
    expect((await del(otherExpert, `/api/notes/${id}`)).status).toBe(404);
    expect((await patch(s.expert, `/api/notes/${id}`, { body: 'Da cap nhat' })).body.body).toBe('Da cap nhat');
    // appointmentId phai thuoc ca nay
    expect((await post(s.expert, `/api/cases/${s.caseId}/notes`, { body: 'x', appointmentId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
    expect((await del(s.expert, `/api/notes/${id}`)).status).toBe(204);
    expect((await s.expert.get(`/api/cases/${s.caseId}/notes`)).body.notes).toHaveLength(0);
  });

  it('nhat ky tam trang: chi khach so huu; chuyen gia chi thay muc da chia se, va chi khi ca dang mo', async () => {
    const s = await setup();
    const priv = await post(s.client, '/api/mood', { mood: 2, note: 'Rat met' });
    const shared = await post(s.client, '/api/mood', { mood: 4, note: 'Kha hon', shared: true });
    expect(priv.status).toBe(201);
    expect(priv.body.shared).toBe(false);
    for (const bad of [0, 6, 2.5]) expect((await post(s.client, '/api/mood', { mood: bad })).status).toBe(400);
    expect((await post(s.client, '/api/mood', { mood: 3, note: 'a'.repeat(501) })).status).toBe(400);

    expect((await s.client.get('/api/mood')).body.entries).toHaveLength(2);
    for (const a of [s.expert, s.admin]) expect((await a.get('/api/mood')).status).toBe(403);
    expect((await post(s.expert, '/api/mood', { mood: 3 })).status).toBe(403);

    // Chua phan ca: chuyen gia khong xem duoc
    expect((await s.expert.get(`/api/cases/${s.caseId}/client-tracking`)).status).toBe(404);
    await assign(s);
    const view = await s.expert.get(`/api/cases/${s.caseId}/client-tracking`);
    expect(view.status).toBe(200);
    expect(view.body.mood.map((m: { id: string }) => m.id)).toEqual([shared.body.id]);
    expect(JSON.stringify(view.body)).not.toContain('Rat met');
    // Khach doi y: thu hoi chia se / chia se them
    await patch(s.client, `/api/mood/${shared.body.id}/shared`, { shared: false });
    await patch(s.client, `/api/mood/${priv.body.id}/shared`, { shared: true });
    expect((await s.expert.get(`/api/cases/${s.caseId}/client-tracking`)).body.mood.map((m: { id: string }) => m.id)).toEqual([priv.body.id]);
    // Quan tri vien, khach, chuyen gia khac khong dung duoc endpoint chuyen gia
    expect((await s.admin.get(`/api/cases/${s.caseId}/client-tracking`)).status).toBe(403);
    expect((await s.client.get(`/api/cases/${s.caseId}/client-tracking`)).status).toBe(403);
    const other = await createUser(app, 'expert');
    await linkExpert(app, other.id, ['lo-au']);
    expect((await (await loginAs(app, other)).get(`/api/cases/${s.caseId}/client-tracking`)).status).toBe(404);
    // Khach khac khong sua/xoa duoc muc cua nguoi khac
    const stranger = await loginAs(app, await createUser(app, 'client'));
    expect((await patch(stranger, `/api/mood/${priv.body.id}/shared`, { shared: false })).status).toBe(404);
    expect((await del(stranger, `/api/mood/${priv.body.id}`)).status).toBe(404);
    expect((await del(s.client, `/api/mood/${priv.body.id}`)).status).toBe(204);
  });

  it('tu danh gia: may chu tu tinh diem, canh bao cau 9, chi chia se khi khach dong y', async () => {
    const s = await setup();
    const mild = await post(s.client, '/api/assessments', { kind: 'gad7', answers: [1, 1, 1, 1, 1, 1, 1], score: 21, shared: true });
    expect(mild.status).toBe(201);
    expect(mild.body.score).toBe(7); // bo qua diem do client gui
    expect(mild.body.severity).toBe('mild');
    expect(mild.body.urgent).toBe(false);
    const risk = await post(s.client, '/api/assessments', { kind: 'phq9', answers: [0, 0, 0, 0, 0, 0, 0, 0, 1] });
    expect(risk.body.urgent).toBe(true);
    for (const bad of [{ kind: 'phq9', answers: [0, 0] }, { kind: 'xyz', answers: [] }, { kind: 'gad7', answers: [4, 0, 0, 0, 0, 0, 0] }]) {
      expect((await post(s.client, '/api/assessments', bad)).status).toBe(400);
    }
    expect((await s.client.get('/api/assessments/mine')).body.results).toHaveLength(2);
    for (const a of [s.expert, s.admin]) expect((await a.get('/api/assessments/mine')).status).toBe(403);

    await assign(s);
    const view = await s.expert.get(`/api/cases/${s.caseId}/client-tracking`);
    expect(view.body.assessments.map((r: { id: string }) => r.id)).toEqual([mild.body.id]); // ket qua cau 9 chua chia se thi khong lo
    expect((await del(s.client, `/api/assessments/${mild.body.id}`)).status).toBe(204);
    expect((await s.expert.get(`/api/cases/${s.caseId}/client-tracking`)).body.assessments).toHaveLength(0);
  });

  it('bai tap: chuyen gia giao, khach nop mot lan; quan tri vien va nguoi la khong thay', async () => {
    const s = await setup();
    const url = `/api/cases/${s.caseId}/homework`;
    expect((await post(s.expert, url, { title: 'Nhat ky bietcam' })).status).toBe(404); // chua phan ca
    await assign(s);
    expect((await post(s.client, url, { title: 'Tu giao bai' })).status).toBe(403);
    expect((await post(s.admin, url, { title: 'Admin giao bai' })).status).toBe(403);
    expect((await post(s.expert, url, { title: '' })).status).toBe(400);
    expect((await post(s.expert, url, { title: 'Bai tap', dueDate: 'mai' })).status).toBe(400);

    const hw = await post(s.expert, url, { title: 'Ghi nhat ky bietcam', instructions: 'Moi toi 10 phut', dueDate: '2030-01-31' });
    expect(hw.status).toBe(201);
    expect(hw.body.response).toBeNull();
    const id = hw.body.id as string;

    expect((await s.client.get(url)).body.homework).toHaveLength(1);
    expect((await s.expert.get(url)).body.homework).toHaveLength(1);
    expect((await s.admin.get(url)).status).toBe(403);
    const stranger = await loginAs(app, await createUser(app, 'client'));
    expect((await stranger.get(url)).status).toBe(404);
    const other = await createUser(app, 'expert');
    await linkExpert(app, other.id, ['lo-au']);
    expect((await (await loginAs(app, other)).get(url)).status).toBe(404);

    expect((await patch(s.expert, `/api/homework/${id}/submit`, { response: 'x' })).status).toBe(403);
    expect((await patch(stranger, `/api/homework/${id}/submit`, { response: 'x' })).status).toBe(404);
    expect((await patch(s.client, `/api/homework/${id}/submit`, { response: '   ' })).status).toBe(400);
    const done = await patch(s.client, `/api/homework/${id}/submit`, { response: 'Da lam 3 ngay' });
    expect(done.status).toBe(200);
    expect(done.body.submittedAt).toBeTruthy();
    expect((await patch(s.client, `/api/homework/${id}/submit`, { response: 'Sua lai' })).status).toBe(409);
    expect((await s.expert.get(url)).body.homework[0].response).toBe('Da lam 3 ngay');
  });

  it('thong bao: sinh ra theo su kien, chi nguoi nhan doc va danh dau da doc', async () => {
    const s = await setup();
    await transition(s.admin, s.caseId, { to: 'approved' });
    await transition(s.admin, s.caseId, { to: 'assigned', expertId: s.expertUser.id });
    await post(s.expert, `/api/cases/${s.caseId}/homework`, { title: 'Bai tap moi' });

    const mine = await s.client.get('/api/notifications');
    expect(mine.status).toBe(200);
    const types = mine.body.notifications.map((n: { type: string }) => n.type).sort();
    expect(types).toEqual(['case.approved', 'case.assigned', 'homework.assigned']);
    expect(mine.body.unread).toBe(3);
    const expertTypes = (await s.expert.get('/api/notifications')).body.notifications.map((n: { type: string }) => n.type);
    expect(expertTypes).toEqual(['case.assigned']);
    expect((await s.admin.get('/api/notifications')).body.notifications).toHaveLength(0);
    expect((await request(app.getHttpServer()).get('/api/notifications')).status).toBe(401);

    const first = mine.body.notifications[0].id as string;
    // Nguoi khac khong danh dau da doc thong bao cua minh duoc
    expect((await post(s.expert, '/api/notifications/read', { ids: [first] })).status).toBe(204);
    expect((await s.client.get('/api/notifications')).body.unread).toBe(3);
    expect((await post(s.client, '/api/notifications/read', { ids: [first] })).status).toBe(204);
    expect((await s.client.get('/api/notifications')).body.unread).toBe(2);
    expect((await post(s.client, '/api/notifications/read', { all: true })).status).toBe(204);
    expect((await s.client.get('/api/notifications')).body.unread).toBe(0);
    expect((await post(s.client, '/api/notifications/read', { ids: ['khong-phai-uuid'] })).status).toBe(400);
  });
});
