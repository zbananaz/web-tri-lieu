import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Pool } from 'pg';
import { POOL } from '../src/db/db.module.js';
import { type Agent, ORIGIN, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';
import { linkExpert, seedScreening, submitCase, transition } from './fixtures.js';

describe('Sang loc, duyet va phan ca', () => {
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
    const expert = await createUser(app, 'expert', { fullName: 'Chuyen gia A', phone: '0911111111' });
    await linkExpert(app, expert.id, ['lo-au']);
    const clientUser = await createUser(app, 'client', { fullName: 'Khach A', phone: '0922222222' });
    return {
      admin,
      expert,
      clientUser,
      adminAgent: await loginAs(app, admin),
      expertAgent: await loginAs(app, expert),
      client: await loginAs(app, clientUser),
    };
  }

  /** Dua mot ca toi trang thai 'assigned' cho chuyen gia chi dinh. */
  async function assignedCase(s: Awaited<ReturnType<typeof setup>>) {
    const res = await submitCase(s.client, questions);
    const id = res.body.id as string;
    expect((await transition(s.adminAgent, id, { to: 'approved' })).status).toBe(200);
    expect((await transition(s.adminAgent, id, { to: 'assigned', expertId: s.expert.id })).status).toBe(200);
    return id;
  }

  describe('cau hoi sang loc', () => {
    it('cong khai nhung khong lo co nguy co hay goi y chuyen mon', async () => {
      const res = await request(app.getHttpServer()).get('/api/screening/questions');
      expect(res.status).toBe(200);
      expect(res.body.questions).toHaveLength(3);
      expect(JSON.stringify(res.body.questions)).not.toMatch(/risk|specialties|urgent|elevated/);
      expect(res.body.hotlines.length).toBeGreaterThan(0);
    });

    it('chi admin moi sua duoc bo cau hoi', async () => {
      const s = await setup();
      const body = { prompt: 'Cau hoi moi nhat', type: 'text', position: 9 };
      expect((await s.client.post('/api/admin/screening-questions').set('Origin', ORIGIN).send(body)).status).toBe(403);
      expect((await s.expertAgent.post('/api/admin/screening-questions').set('Origin', ORIGIN).send(body)).status).toBe(403);
      expect((await s.adminAgent.post('/api/admin/screening-questions').set('Origin', ORIGIN).send(body)).status).toBe(201);
      expect((await s.adminAgent.post('/api/admin/screening-questions').set('Origin', ORIGIN).send({ ...body, type: 'single' })).status).toBe(400);
    });
  });

  describe('khach gui bai sang loc', () => {
    it('tao ca o trang thai cho duyet, khong co hotline khi khong co nguy co', async () => {
      const s = await setup();
      const res = await submitCase(s.client, questions);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'submitted', riskLevel: 'none', hotlines: [] });
    });

    it('dap an nguy co cao tra hotline ngay va danh dau ca khan cap cho admin', async () => {
      const s = await setup();
      const res = await submitCase(s.client, questions, { risk: 'thuong-xuyen' });
      expect(res.status).toBe(201);
      expect(res.body.riskLevel).toBe('urgent');
      expect(res.body.hotlines.length).toBeGreaterThan(0);

      const other = await loginAs(app, await createUser(app, 'client'));
      await submitCase(other, questions, { risk: 'khong' });
      const list = await s.adminAgent.get('/api/admin/cases');
      expect(list.body.cases[0].riskLevel).toBe('urgent'); // ca khan cap luon dung dau
      expect(list.body.cases).toHaveLength(2);
    });

    it('muc nguy co cao nhat quyet dinh khi chon nhieu dap an', async () => {
      const s = await setup();
      const res = await submitCase(s.client, questions, { risk: 'thinh-thoang' });
      expect(res.body.riskLevel).toBe('elevated');
    });

    it('tu choi du lieu khong hop le', async () => {
      const s = await setup();
      const post = (body: object) => s.client.post('/api/cases').set('Origin', ORIGIN).send(body);
      expect((await post({ answers: [] })).status).toBe(400); // thieu cau bat buoc
      expect((await post({ answers: [{ questionId: questions[0]!.id, value: 'khong-co' }, { questionId: questions[1]!.id, value: 'khong' }] })).status).toBe(400);
      expect((await post({ answers: [{ questionId: '00000000-0000-4000-8000-000000000000', value: 'x' }] })).status).toBe(400);
      expect((await post({ answers: [{ questionId: questions[0]!.id, value: ['tot', 'lo-au'] }, { questionId: questions[1]!.id, value: 'khong' }] })).status).toBe(400); // single chon 2
    });

    it('chi khach hang moi duoc gui, an danh bi tu choi', async () => {
      const s = await setup();
      expect((await submitCase(s.adminAgent, questions)).status).toBe(403);
      expect((await submitCase(s.expertAgent, questions)).status).toBe(403);
      expect((await request(app.getHttpServer()).post('/api/cases').set('Origin', ORIGIN).send({ answers: [] })).status).toBe(401);
    });

    it('khong gui them khi con yeu cau dang mo, nhung duoc gui lai sau khi bi tu choi', async () => {
      const s = await setup();
      const first = await submitCase(s.client, questions);
      expect((await submitCase(s.client, questions)).status).toBe(409);
      expect((await transition(s.adminAgent, first.body.id, { to: 'rejected', note: 'Chua phu hop' })).status).toBe(200);
      expect((await submitCase(s.client, questions)).status).toBe(201);
    });
  });

  describe('quyen truy cap theo doi tuong', () => {
    it('khach khong xem duoc ca cua khach khac (404)', async () => {
      const s = await setup();
      const id = (await submitCase(s.client, questions)).body.id;
      const intruder = await loginAs(app, await createUser(app, 'client'));
      expect((await intruder.get(`/api/cases/${id}`)).status).toBe(404);
      expect((await s.client.get(`/api/cases/${id}`)).status).toBe(200);
      expect((await intruder.get('/api/cases/mine')).body.cases).toHaveLength(0);
    });

    it('chuyen gia khong thay ca chua phan cho minh, ke ca khi ca da duoc duyet', async () => {
      const s = await setup();
      const id = (await submitCase(s.client, questions)).body.id;
      expect((await s.expertAgent.get(`/api/cases/${id}`)).status).toBe(404);
      await transition(s.adminAgent, id, { to: 'approved' });
      expect((await s.expertAgent.get(`/api/cases/${id}`)).status).toBe(404);
      expect((await s.expertAgent.get('/api/expert/cases')).body.cases).toHaveLength(0);
    });

    it('chuyen gia duoc phan thay thong tin lien he, chuyen gia khac thi khong', async () => {
      const s = await setup();
      const id = await assignedCase(s);
      const detail = await s.expertAgent.get(`/api/cases/${id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.client).toMatchObject({ fullName: 'Khach A', phone: '0922222222' });
      expect(detail.body.adminNote).toBeUndefined();
      expect((await s.expertAgent.get('/api/expert/cases')).body.cases).toHaveLength(1);

      const other = await createUser(app, 'expert');
      await linkExpert(app, other.id, []);
      const otherAgent = await loginAs(app, other);
      expect((await otherAgent.get(`/api/cases/${id}`)).status).toBe(404);
      expect((await transition(otherAgent, id, { to: 'contacted' })).status).toBe(404);
    });

    it('khach chi thay cau tra loi cua minh, khong thay co nguy co, ghi chu admin hay goi y', async () => {
      const s = await setup();
      const id = (await submitCase(s.client, questions, { risk: 'thuong-xuyen' })).body.id;
      await s.adminAgent.post(`/api/admin/cases/${id}/note`).set('Origin', ORIGIN).send({ note: 'Goi lai gap trong ngay' });
      const detail = await s.client.get(`/api/cases/${id}`);
      expect(detail.status).toBe(200);
      const text = JSON.stringify(detail.body);
      expect(text).not.toMatch(/Goi lai gap|suggestions|specialties|"risk"/);
      expect(detail.body.answers[0].labels).toEqual(['Hay lo lắng']);
      expect(detail.body.hotlines.length).toBeGreaterThan(0);
    });

    it('admin thay day du, kem goi y chuyen gia', async () => {
      const s = await setup();
      const id = (await submitCase(s.client, questions)).body.id;
      await transition(s.adminAgent, id, { to: 'approved' });
      const detail = await s.adminAgent.get(`/api/cases/${id}`);
      expect(detail.body.client.email).toBe(s.clientUser.email);
      expect(detail.body.suggestions[0]).toMatchObject({ expertId: s.expert.id });
    });

    it('chi admin moi goi duoc ham admin', async () => {
      const s = await setup();
      for (const agent of [s.client, s.expertAgent]) {
        expect((await agent.get('/api/admin/cases')).status).toBe(403);
      }
      expect((await request(app.getHttpServer()).get('/api/admin/cases')).status).toBe(401);
    });
  });

  describe('may trang thai cua ca', () => {
    it('khach va chuyen gia khong duyet / phan ca duoc', async () => {
      const s = await setup();
      const id = (await submitCase(s.client, questions)).body.id;
      expect((await transition(s.client, id, { to: 'approved' })).status).toBe(403);
      expect((await transition(s.expertAgent, id, { to: 'approved' })).status).toBe(404); // chua phan => khong thay ca
    });

    it('chuyen trang thai khong hop le bi tu choi (409)', async () => {
      const s = await setup();
      const id = (await submitCase(s.client, questions)).body.id;
      expect((await transition(s.adminAgent, id, { to: 'assigned', expertId: s.expert.id })).status).toBe(409); // chua duyet
      expect((await transition(s.adminAgent, id, { to: 'in_treatment' })).status).toBe(409);
    });

    it('tu choi can ly do va khach thay ly do do', async () => {
      const s = await setup();
      const id = (await submitCase(s.client, questions)).body.id;
      expect((await transition(s.adminAgent, id, { to: 'rejected' })).status).toBe(400);
      expect((await transition(s.adminAgent, id, { to: 'rejected', note: 'Can gap bac si tam than' })).status).toBe(200);
      const mine = await s.client.get('/api/cases/mine');
      expect(mine.body.cases[0]).toMatchObject({ status: 'rejected', rejectionReason: 'Can gap bac si tam than' });
      expect((await transition(s.adminAgent, id, { to: 'approved' })).status).toBe(409); // da ket thuc
    });

    it('phan ca can chuyen gia hop le dang hoat dong', async () => {
      const s = await setup();
      const id = (await submitCase(s.client, questions)).body.id;
      await transition(s.adminAgent, id, { to: 'approved' });
      expect((await transition(s.adminAgent, id, { to: 'assigned' })).status).toBe(400);
      expect((await transition(s.adminAgent, id, { to: 'assigned', expertId: s.clientUser.id })).status).toBe(400); // khong phai chuyen gia
      const pool = app.get<Pool>(POOL);
      await pool.query('update expert_profiles set active = false where user_id = $1', [s.expert.id]);
      expect((await transition(s.adminAgent, id, { to: 'assigned', expertId: s.expert.id })).status).toBe(400); // tam ngung
    });

    it('luong day du: phan ca -> lien he -> dang tri lieu -> ket thuc, ghi lich su', async () => {
      const s = await setup();
      const id = await assignedCase(s);
      expect((await transition(s.expertAgent, id, { to: 'contacted' })).status).toBe(200);
      expect((await transition(s.expertAgent, id, { to: 'in_treatment' })).status).toBe(200);
      expect((await transition(s.expertAgent, id, { to: 'closed' })).status).toBe(200);
      expect((await transition(s.expertAgent, id, { to: 'in_treatment' })).status).toBe(409);
      const detail = await s.adminAgent.get(`/api/cases/${id}`);
      expect(detail.body.events.map((e: { toStatus: string }) => e.toStatus)).toEqual([
        'submitted', 'approved', 'assigned', 'contacted', 'in_treatment', 'closed',
      ]);
    });

    it('chuyen gia tu choi ca (can ly do): ca quay ve hang cho va chuyen gia mat quyen xem', async () => {
      const s = await setup();
      const id = await assignedCase(s);
      expect((await transition(s.expertAgent, id, { to: 'approved' })).status).toBe(400);
      expect((await transition(s.expertAgent, id, { to: 'approved', note: 'Ngoai chuyen mon' })).status).toBe(200);
      expect((await s.expertAgent.get(`/api/cases/${id}`)).status).toBe(404);
      const detail = await s.adminAgent.get(`/api/cases/${id}`);
      expect(detail.body).toMatchObject({ status: 'approved', assignedExpertId: null });
    });

    it('admin duoc doi chuyen gia khi ca dang o trang thai da phan', async () => {
      const s = await setup();
      const id = await assignedCase(s);
      const second = await createUser(app, 'expert');
      await linkExpert(app, second.id, []);
      expect((await transition(s.adminAgent, id, { to: 'assigned', expertId: second.id })).status).toBe(200);
      expect((await s.expertAgent.get(`/api/cases/${id}`)).status).toBe(404);
      expect((await (await loginAs(app, second)).get(`/api/cases/${id}`)).status).toBe(200);
    });
  });

  describe('nhat ky audit', () => {
    it('ghi lai viec doc ho so khach va moi lan chuyen trang thai, khong ghi noi dung cau tra loi', async () => {
      const s = await setup();
      const id = await assignedCase(s);
      await s.expertAgent.get(`/api/cases/${id}`);
      await s.client.get(`/api/cases/${id}`);
      const pool = app.get<Pool>(POOL);
      const { rows } = await pool.query<{ action: string; actor_id: string; meta: unknown }>(
        'select action, actor_id, meta from audit_logs where entity_id = $1 order by id',
        [id],
      );
      const reads = rows.filter((r) => r.action === 'case.read');
      expect(reads).toHaveLength(1); // chi chuyen gia; khach doc ca cua chinh minh khong can audit
      expect(reads[0]!.actor_id).toBe(s.expert.id);
      expect(rows.filter((r) => r.action === 'case.transition')).toHaveLength(2);
      expect(JSON.stringify(rows)).not.toMatch(/mat ngu|Hay lo lang/i);
    });
  });
});

export type { Agent };
