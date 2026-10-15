import type { NestExpressApplication } from '@nestjs/platform-express';
import { ORIGIN, PASSWORD, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';

describe('Xac thuc va phan quyen', () => {
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

  const post = (path: string, body: object) => request(app.getHttpServer()).post(path).set('Origin', ORIGIN).send(body);

  describe('dang ky / dang nhap', () => {
    it('dang ky tao khach hang, dat cookie httpOnly va /me tra dung nguoi dung', async () => {
      const agent = request.agent(app.getHttpServer());
      const res = await agent
        .post('/api/auth/register')
        .set('Origin', ORIGIN)
        .send({ email: 'Khach@Test.local', password: PASSWORD, fullName: 'Nguyen Van A' });
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ email: 'khach@test.local', role: 'client' });
      const cookie = res.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);

      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('khach@test.local');
    });

    it('khong the tu dang ky lam admin hay chuyen gia bang cach gui role', async () => {
      const res = await post('/api/auth/register', {
        email: 'hacker@test.local',
        password: PASSWORD,
        fullName: 'Hacker',
        role: 'admin',
      });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('client');
    });

    it('email trung bi tu choi (409) va du lieu sai bi tu choi (400)', async () => {
      await post('/api/auth/register', { email: 'a@test.local', password: PASSWORD, fullName: 'A A' });
      expect((await post('/api/auth/register', { email: 'a@test.local', password: PASSWORD, fullName: 'A A' })).status).toBe(409);
      const bad = await post('/api/auth/register', { email: 'khong-phai-email', password: '123', fullName: 'A' });
      expect(bad.status).toBe(400);
      expect(bad.body.issues.length).toBeGreaterThan(0);
    });

    it('mat khau sai va email khong ton tai cho cung mot thong bao, khong lo tai khoan co ton tai', async () => {
      const u = await createUser(app, 'client');
      const wrongPw = await post('/api/auth/login', { email: u.email, password: 'SaiMatKhau1' });
      const noUser = await post('/api/auth/login', { email: 'khong-co@test.local', password: 'SaiMatKhau1' });
      expect(wrongPw.status).toBe(401);
      expect(noUser.status).toBe(401);
      expect(wrongPw.body.message).toBe(noUser.body.message);
    });

    it('khoa tam tai khoan sau 5 lan dang nhap sai, ke ca khi sau do nhap dung mat khau', async () => {
      const u = await createUser(app, 'client');
      for (let i = 0; i < 5; i++) {
        expect((await post('/api/auth/login', { email: u.email, password: 'SaiMatKhau1' })).status).toBe(401);
      }
      const locked = await post('/api/auth/login', { email: u.email, password: u.password });
      expect(locked.status).toBe(429);
    });

    it('dang xuat huy phien that su tren may chu', async () => {
      const u = await createUser(app, 'client');
      const login = await post('/api/auth/login', { email: u.email, password: u.password });
      const cookie = (login.headers['set-cookie']?.[0] ?? '').split(';')[0]!;
      const server = () => request(app.getHttpServer());
      expect((await server().get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
      expect((await server().post('/api/auth/logout').set('Origin', ORIGIN).set('Cookie', cookie)).status).toBe(204);
      // Dung lai chinh cookie cu: phien da bi xoa o DB nen van phai bi tu choi.
      expect((await server().get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
    });

    it('doi mat khau dang xuat cac thiet bi khac', async () => {
      const u = await createUser(app, 'client');
      const phone = await loginAs(app, u);
      const laptop = await loginAs(app, u);
      const res = await laptop
        .post('/api/auth/change-password')
        .set('Origin', ORIGIN)
        .send({ currentPassword: u.password, newPassword: 'MatKhauMoi99' });
      expect(res.status).toBe(204);
      expect((await laptop.get('/api/auth/me')).status).toBe(200);
      expect((await phone.get('/api/auth/me')).status).toBe(401);
    });

    it('tai khoan bi vo hieu hoa khong dang nhap duoc va phien cu mat hieu luc', async () => {
      const u = await createUser(app, 'client');
      const agent = await loginAs(app, u);
      const pool = (await import('../src/db/db.module.js')).POOL;
      await app.get<import('pg').Pool>(pool).query("update users set status = 'disabled' where id = $1", [u.id]);
      expect((await agent.get('/api/auth/me')).status).toBe(401);
      expect((await post('/api/auth/login', { email: u.email, password: u.password })).status).toBe(401);
    });
  });

  describe('chong CSRF', () => {
    it('request doi du lieu bang cookie ma khong co Origin bi tu choi (403)', async () => {
      const u = await createUser(app, 'client');
      const agent = await loginAs(app, u);
      expect((await agent.post('/api/auth/logout')).status).toBe(403);
      expect((await agent.get('/api/auth/me')).status).toBe(200);
    });

    it('Origin la trang la bi tu choi (403)', async () => {
      const u = await createUser(app, 'client');
      const agent = await loginAs(app, u);
      expect((await agent.post('/api/auth/logout').set('Origin', 'https://evil.example')).status).toBe(403);
      expect((await request(app.getHttpServer()).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: u.email, password: u.password })).status).toBe(403);
    });

    it('client dung Bearer (mobile) khong co Origin van dung duoc', async () => {
      const u = await createUser(app, 'client');
      const { token } = await issueToken(u.id);
      const res = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(u.email);
    });

    async function issueToken(userId: string) {
      const { SessionService } = await import('../src/auth/session.service.js');
      const created = await app.get(SessionService).create(userId, {});
      return { token: created.token };
    }
  });

  describe('phan quyen theo vai tro (RBAC)', () => {
    it.each([
      ['an danh', null, 401],
      ['khach', 'client', 403],
      ['chuyen gia', 'expert', 403],
      ['quan tri vien', 'admin', 200],
    ] as const)('GET /api/admin/users: %s => %i', async (_label, role, expected) => {
      const agent = role ? await loginAs(app, await createUser(app, role)) : request.agent(app.getHttpServer());
      const res = await agent.get('/api/admin/users');
      expect(res.status).toBe(expected);
      if (expected === 200) {
        expect(Array.isArray(res.body.users)).toBe(true);
        expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash/);
      }
    });

    it('token gia / khong ton tai bi tu choi 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', 'Bearer khong-ton-tai');
      expect(res.status).toBe(401);
    });

    it('health la route cong khai', async () => {
      expect((await request(app.getHttpServer()).get('/api/health')).status).toBe(200);
    });
  });

  describe('nhat ky audit', () => {
    it('ghi nhan dang nhap that bai va viec admin xem danh sach nguoi dung', async () => {
      const client = await createUser(app, 'client');
      await post('/api/auth/login', { email: client.email, password: 'SaiMatKhau1' });
      const admin = await createUser(app, 'admin');
      await (await loginAs(app, admin)).get('/api/admin/users');
      const pool = app.get<import('pg').Pool>((await import('../src/db/db.module.js')).POOL);
      const { rows } = await pool.query<{ action: string }>('select action from audit_logs order by id');
      const actions = rows.map((r) => r.action);
      expect(actions).toContain('auth.login_failed');
      expect(actions).toContain('users.list');
    });
  });
});
