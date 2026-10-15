import type { NestExpressApplication } from '@nestjs/platform-express';
import { ORIGIN, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';

describe('Quan tri tai khoan va nhat ky', () => {
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

  it('chi admin xem duoc danh sach nguoi dung va nhat ky', async () => {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    const client = await loginAs(app, await createUser(app, 'client'));
    const expert = await loginAs(app, await createUser(app, 'expert'));
    for (const path of ['/api/admin/users', '/api/admin/audit-logs']) {
      expect((await client.get(path)).status).toBe(403);
      expect((await expert.get(path)).status).toBe(403);
      expect((await request(app.getHttpServer()).get(path)).status).toBe(401);
      expect((await admin.get(path)).status).toBe(200);
    }
    const logs = await admin.get('/api/admin/audit-logs?limit=5');
    expect(logs.body.logs.length).toBeGreaterThan(0);
    expect(logs.body.logs[0]).not.toHaveProperty('meta');
    expect((await admin.get('/api/admin/audit-logs?limit=100000')).status).toBe(400);
  });

  it('khoa tai khoan huy phien ngay lap tuc, mo khoa dang nhap lai duoc', async () => {
    const adminUser = await createUser(app, 'admin');
    const admin = await loginAs(app, adminUser);
    const target = await createUser(app, 'client');
    const targetAgent = await loginAs(app, target);
    expect((await targetAgent.get('/api/auth/me')).status).toBe(200);

    const off = await admin.patch(`/api/admin/users/${target.id}/status`).set('Origin', ORIGIN).send({ status: 'disabled' });
    expect(off.status).toBe(200);
    expect((await targetAgent.get('/api/auth/me')).status).toBe(401);
    const relogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: target.email, password: target.password });
    expect(relogin.status).toBe(401);

    await admin.patch(`/api/admin/users/${target.id}/status`).set('Origin', ORIGIN).send({ status: 'active' });
    expect((await loginAs(app, target)).get).toBeDefined();
  });

  it('khong tu khoa minh, id la 404, nguoi khac khong khoa duoc', async () => {
    const adminUser = await createUser(app, 'admin');
    const admin = await loginAs(app, adminUser);
    const client = await loginAs(app, await createUser(app, 'client'));
    expect((await admin.patch(`/api/admin/users/${adminUser.id}/status`).set('Origin', ORIGIN).send({ status: 'disabled' })).status).toBe(400);
    expect((await admin.patch('/api/admin/users/00000000-0000-4000-8000-000000000000/status').set('Origin', ORIGIN).send({ status: 'disabled' })).status).toBe(404);
    expect((await admin.patch(`/api/admin/users/${adminUser.id}/status`).set('Origin', ORIGIN).send({ status: 'weird' })).status).toBe(400);
    expect((await client.patch(`/api/admin/users/${adminUser.id}/status`).set('Origin', ORIGIN).send({ status: 'disabled' })).status).toBe(403);
  });
});
