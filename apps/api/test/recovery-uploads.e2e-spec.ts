import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { env } from '../src/config/env.js';
import { type Agent, ORIGIN, PASSWORD, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(64)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBP'), randomBytes(32)]);

describe('Khoi phuc mat khau do quan tri cap', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  it('chi admin duoc dat lai; khong dat lai admin khac, chinh minh, hoac tai khoan khong ton tai', async () => {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    const otherAdmin = await createUser(app, 'admin');
    const client = await createUser(app, 'client');
    const clientAgent = await loginAs(app, client);
    const expertAgent = await loginAs(app, await createUser(app, 'expert'));
    const url = (id: string) => `/api/admin/users/${id}/reset-password`;

    expect((await clientAgent.post(url(client.id)).set('Origin', ORIGIN)).status).toBe(403);
    expect((await expertAgent.post(url(client.id)).set('Origin', ORIGIN)).status).toBe(403);
    expect((await request(app.getHttpServer()).post(url(client.id)).set('Origin', ORIGIN)).status).toBe(401);
    expect((await admin.post(url(otherAdmin.id)).set('Origin', ORIGIN)).status).toBe(403);
    expect((await admin.post(url('00000000-0000-4000-8000-000000000000')).set('Origin', ORIGIN)).status).toBe(404);
    expect((await admin.post(url('khong-phai-uuid')).set('Origin', ORIGIN)).status).toBe(400);
    const me = (await admin.get('/api/auth/me')).body.user.id as string;
    expect((await admin.post(url(me)).set('Origin', ORIGIN)).status).toBe(400);
  });

  it('mat khau tam: huy phien cu, xoa khoa, buoc doi mat khau truoc khi lam gi khac, khong ghi vao nhat ky', async () => {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    const client = await createUser(app, 'client');
    const old = await loginAs(app, client);
    // Lam tai khoan bi khoa do dang nhap sai
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/api/auth/login').set('Origin', ORIGIN).send({ email: client.email, password: 'sai-mat-khau-1' });
    }

    const res = await admin.post(`/api/admin/users/${client.id}/reset-password`).set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    const temp = res.body.temporaryPassword as string;
    expect(temp).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{14}$/);
    expect((await old.get('/api/auth/me')).status).toBe(401); // phien cu bi huy

    const fresh = request.agent(app.getHttpServer());
    const login = await fresh.post('/api/auth/login').set('Origin', ORIGIN).send({ email: client.email, password: temp });
    expect(login.status).toBe(200); // het khoa
    expect(login.body.user.mustChangePassword).toBe(true);
    expect((await fresh.get('/api/auth/me')).status).toBe(200);

    // Socket realtime cung phai tu choi khi con mat khau tam
    const cookie = (login.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
    await app.listen(0, '127.0.0.1');
    const { io } = await import('socket.io-client');
    const addr = app.getHttpServer().address() as { port: number };
    const sock = io(`http://127.0.0.1:${addr.port}`, { extraHeaders: { cookie, origin: ORIGIN }, transports: ['websocket'], reconnection: false });
    const err = await new Promise<string>((resolve) => {
      sock.on('connect_error', (e) => resolve(e.message));
      sock.on('connect', () => resolve('connected'));
    });
    sock.close();
    expect(err).toBe('unauthorized');

    const blocked = await fresh.get('/api/cases/mine');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await fresh.post('/api/auth/change-password').set('Origin', ORIGIN).send({ currentPassword: temp, newPassword: temp })).status).toBe(400);
    const changed = await fresh.post('/api/auth/change-password').set('Origin', ORIGIN).send({ currentPassword: temp, newPassword: `${PASSWORD}x` });
    expect(changed.status).toBe(204);
    expect((await fresh.get('/api/auth/me')).body.user.mustChangePassword).toBeUndefined();
    expect((await fresh.get('/api/cases/mine')).status).not.toBe(403);
    expect((await loginAs(app, { email: client.email, password: `${PASSWORD}x` })).get).toBeDefined();

    const logs = JSON.stringify((await admin.get('/api/admin/audit-logs?limit=50')).body);
    expect(logs).toContain('user.reset_password');
    expect(logs).not.toContain(temp);
  });
});

describe('Tai anh bai viet len', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await rm(env.uploadDir, { recursive: true, force: true });
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  const post = (agent: Agent, body: Buffer, type: string) =>
    agent.post('/api/admin/uploads').set('Origin', ORIGIN).set('Content-Type', type).send(body);

  it('chi admin tai len; khach, chuyen gia, nguoi chua dang nhap bi tu choi', async () => {
    const client = await loginAs(app, await createUser(app, 'client'));
    const expert = await loginAs(app, await createUser(app, 'expert'));
    expect((await post(client, PNG, 'image/png')).status).toBe(403);
    expect((await post(expert, PNG, 'image/png')).status).toBe(403);
    expect((await request(app.getHttpServer()).post('/api/admin/uploads').set('Origin', ORIGIN).set('Content-Type', 'image/png').send(PNG)).status).toBe(401);
  });

  it('nhan PNG/JPEG/WebP that, ten ngau nhien, phuc vu cong khai voi header an toan', async () => {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    for (const [buf, type, ext] of [[PNG, 'image/png', 'png'], [JPEG, 'image/jpeg', 'jpg'], [WEBP, 'image/webp', 'webp']] as const) {
      const res = await post(admin, buf, type);
      expect(res.status).toBe(201);
      expect(res.body.url).toMatch(new RegExp(`^/api/uploads/[a-f0-9]{32}\\.${ext}$`));
      const got = await request(app.getHttpServer()).get(res.body.url); // khong can dang nhap
      expect(got.status).toBe(200);
      expect(got.headers['content-type']).toContain(type);
      expect(got.headers['x-content-type-options']).toBe('nosniff');
      expect(got.headers['content-security-policy']).toContain("default-src 'none'");
      expect(Buffer.compare(got.body as Buffer, buf)).toBe(0);
    }
  });

  it('tu choi tep gia anh, sai kieu, rong, qua lon; ten file khong duoc vuot thu muc', async () => {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    expect((await post(admin, Buffer.from('<script>alert(1)</script>'), 'image/png')).status).toBe(415);
    expect((await post(admin, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml')).status).toBe(415);
    expect((await post(admin, PNG, 'image/jpeg')).status).toBe(415); // khai bao khong khop noi dung
    expect((await post(admin, Buffer.alloc(0), 'image/png')).status).toBe(400);
    expect((await post(admin, Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]), 'image/png')).status).toBe(413);
    for (const name of ['..%2F..%2F.env', 'x.png', '../x', `${'a'.repeat(32)}.svg`, `${'a'.repeat(32)}.png`]) {
      expect((await request(app.getHttpServer()).get(`/api/uploads/${name}`)).status).toBe(404);
    }
    expect(existsSync(join(env.uploadDir, `${'a'.repeat(32)}.png`))).toBe(false);
  });

  it('anh bia chi nhan https hoac duong dan anh da tai len', async () => {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    const base = { title: 'Bai viet thu', contentHtml: '<p>noi dung</p>' };
    const ok = await admin.post('/api/admin/articles').set('Origin', ORIGIN).send({ ...base, coverUrl: `/api/uploads/${'b'.repeat(32)}.png` });
    expect(ok.status).toBe(201);
    for (const coverUrl of ['/api/uploads/../../x.png', '/etc/passwd', 'javascript:alert(1)', '//evil.test/x.png']) {
      const bad = await admin.post('/api/admin/articles').set('Origin', ORIGIN).send({ ...base, coverUrl });
      expect(bad.status).toBe(400);
    }
  });
});
