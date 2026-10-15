import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import { type Socket, io as connect } from 'socket.io-client';
import { SessionService } from '../src/auth/session.service.js';
import type { Db } from '../src/db/client.js';
import { DB } from '../src/db/db.module.js';
import { auditLogs } from '../src/db/schema.js';
import { type Agent, ORIGIN, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';
import { linkExpert, seedScreening, submitCase, transition } from './fixtures.js';

describe('Chat', () => {
  let app: NestExpressApplication;
  let questions: { id: string }[];
  let baseUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0, '127.0.0.1');
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
    questions = (await seedScreening(app)).questions;
  });
  afterEach(() => {
    while (sockets.length) sockets.pop()!.disconnect();
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
    return { ...s, caseId: res.body.id as string };
  }
  const assign = async (s: Awaited<ReturnType<typeof setup>>) => {
    await transition(s.adminAgent, s.caseId, { to: 'approved' });
    await transition(s.adminAgent, s.caseId, { to: 'assigned', expertId: s.expert.id });
  };
  const send = (agent: Agent, caseId: string, body: string) =>
    agent.post(`/api/cases/${caseId}/messages`).set('Origin', ORIGIN).send({ body });

  /** Lay cookie phien tu agent (supertest) de socket gui giong trinh duyet. */
  async function cookieOf(user: { email: string; password: string }) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: user.email, password: user.password });
    return (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
  }
  const open = (opts: Record<string, unknown>) => {
    const sock = connect(baseUrl, { transports: ['websocket'], reconnection: false, ...opts });
    sockets.push(sock);
    return sock;
  };
  const waitFor = <T>(sock: Socket, ev: string) => new Promise<T>((resolve) => sock.once(ev, resolve));
  const emitAck = (sock: Socket, ev: string, arg: unknown) => new Promise<{ ok: boolean }>((resolve) => sock.emit(ev, arg, resolve));

  describe('REST', () => {
    it('chua phan cong thi khong nhan tin duoc (409), nguoi la thay 404', async () => {
      const s = await setup();
      expect((await send(s.client, s.caseId, 'xin chao')).status).toBe(409);
      const stranger = await loginAs(app, await createUser(app, 'client'));
      expect((await stranger.get(`/api/cases/${s.caseId}/messages`)).status).toBe(404);
      expect((await send(stranger, s.caseId, 'xin chao')).status).toBe(404);
    });

    it('khach va chuyen gia nhan tin, danh dau da doc, dem tin chua doc', async () => {
      const s = await setup();
      await assign(s);
      expect((await send(s.client, s.caseId, '  Chao bac si  ')).status).toBe(201);
      expect((await send(s.expertAgent, s.caseId, 'Chao ban')).status).toBe(201);
      expect((await send(s.client, s.caseId, '')).status).toBe(400);
      expect((await send(s.client, s.caseId, 'x'.repeat(4001))).status).toBe(400);

      const list = await s.client.get(`/api/cases/${s.caseId}/messages`);
      expect(list.body.messages.map((m: { body: string }) => m.body)).toEqual(['Chao bac si', 'Chao ban']);

      expect((await s.client.get('/api/messages/unread')).body.total).toBe(1);
      expect((await s.expertAgent.get('/api/messages/unread')).body.byCase[s.caseId]).toBe(1);
      const read = await s.client.post(`/api/cases/${s.caseId}/messages/read`).set('Origin', ORIGIN).send({});
      expect(read.body.updated).toBe(1);
      expect((await s.client.get('/api/messages/unread')).body.total).toBe(0);
      // Tin cua chinh minh khong bi danh dau
      expect((await s.expertAgent.get('/api/messages/unread')).body.total).toBe(1);
    });

    it('admin chi xem (khong nhan tin) va moi lan xem deu ghi audit', async () => {
      const s = await setup();
      await assign(s);
      await send(s.client, s.caseId, 'Rieng tu');
      expect((await send(s.adminAgent, s.caseId, 'toi la admin')).status).toBe(403);
      expect((await s.adminAgent.get(`/api/cases/${s.caseId}/messages`)).body.messages).toHaveLength(1);
      const db = app.get<Db>(DB);
      const rows = await db.select().from(auditLogs).where(eq(auditLogs.action, 'chat.read'));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.actorId).toBe(s.admin.id);
      expect(JSON.stringify(rows[0])).not.toContain('Rieng tu');
    });

    it('chuyen gia khac khong doc/gui duoc; ca da dong thi khong gui them', async () => {
      const s = await setup();
      await assign(s);
      const other = await createUser(app, 'expert');
      await linkExpert(app, other.id, ['lo-au']);
      const oe = await loginAs(app, other);
      expect((await oe.get(`/api/cases/${s.caseId}/messages`)).status).toBe(404);
      expect((await send(oe, s.caseId, 'xam nhap')).status).toBe(404);

      expect((await transition(s.expertAgent, s.caseId, { to: 'contacted' })).status).toBe(200);
      expect((await transition(s.expertAgent, s.caseId, { to: 'closed' })).status).toBe(200);
      expect((await send(s.client, s.caseId, 'con do khong')).status).toBe(409);
      expect((await s.client.get(`/api/cases/${s.caseId}/messages`)).status).toBe(200); // van doc duoc lich su
    });

    it('can dang nhap va kiem tra Origin', async () => {
      const s = await setup();
      await assign(s);
      expect((await request(app.getHttpServer()).get(`/api/cases/${s.caseId}/messages`)).status).toBe(401);
      const noOrigin = await s.client.post(`/api/cases/${s.caseId}/messages`).send({ body: 'csrf' });
      expect(noOrigin.status).toBe(403);
      const evil = await s.client.post(`/api/cases/${s.caseId}/messages`).set('Origin', 'https://evil.example').send({ body: 'csrf' });
      expect(evil.status).toBe(403);
    });
  });

  describe('Socket.IO', () => {
    it('khong co phien thi bi tu choi', async () => {
      const sock = open({});
      const err = await new Promise<Error>((resolve) => sock.on('connect_error', resolve));
      expect(err.message).toBe('unauthorized');
    });

    it('Origin la bi tu choi (chong CSWSH)', async () => {
      const s = await setup();
      const cookie = await cookieOf(s.clientUser);
      const sock = open({ extraHeaders: { cookie, origin: 'https://evil.example' } });
      await new Promise<Error>((resolve) => sock.on('connect_error', resolve));
      expect(sock.connected).toBe(false);
    });

    it('thanh vien ca nhan duoc tin nhan realtime; nguoi la khong vao duoc phong', async () => {
      const s = await setup();
      await assign(s);
      const expertSock = open({ extraHeaders: { cookie: await cookieOf(s.expert), origin: ORIGIN } });
      await waitFor(expertSock, 'connect');
      expect(await emitAck(expertSock, 'join', s.caseId)).toEqual({ ok: true });

      const stranger = await createUser(app, 'client');
      const strangerSock = open({ extraHeaders: { cookie: await cookieOf(stranger), origin: ORIGIN } });
      await waitFor(strangerSock, 'connect');
      expect(await emitAck(strangerSock, 'join', s.caseId)).toEqual({ ok: false });
      expect(await emitAck(strangerSock, 'join', 12345)).toEqual({ ok: false });
      let leaked = false;
      strangerSock.on('message', () => (leaked = true));

      const incoming = waitFor<{ body: string; caseId: string }>(expertSock, 'message');
      expect((await send(s.client, s.caseId, 'Realtime nhe')).status).toBe(201);
      expect(await incoming).toMatchObject({ body: 'Realtime nhe', caseId: s.caseId });
      await new Promise((r) => setTimeout(r, 150));
      expect(leaked).toBe(false);
    });

    it('socket khong co duong ghi: gui su kien message khong tao tin nhan', async () => {
      const s = await setup();
      await assign(s);
      const sock = open({ extraHeaders: { cookie: await cookieOf(s.clientUser), origin: ORIGIN } });
      await waitFor(sock, 'connect');
      await emitAck(sock, 'join', s.caseId);
      sock.emit('message', { caseId: s.caseId, body: 'qua socket' });
      await new Promise((r) => setTimeout(r, 150));
      expect((await s.client.get(`/api/cases/${s.caseId}/messages`)).body.messages).toHaveLength(0);
    });

    it('chap nhan Bearer token (chuan bi cho app mobile)', async () => {
      const s = await setup();
      await assign(s);
      const { token } = await app.get(SessionService).create(s.expert.id, {});
      const sock = open({ auth: { token } });
      await waitFor(sock, 'connect');
      expect(await emitAck(sock, 'join', s.caseId)).toEqual({ ok: true });
    });
  });
});
