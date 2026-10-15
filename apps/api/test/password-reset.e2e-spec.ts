import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import { env } from '../src/config/env.js';
import type { Db } from '../src/db/client.js';
import { DB } from '../src/db/db.module.js';
import { passwordResetTokens, users } from '../src/db/schema.js';
import { ORIGIN, PASSWORD, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';

interface Mail {
  to: string;
  subject: string;
  text: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function outbox(): Promise<Mail[]> {
  const files = await readdir(env.outboxDir).catch(() => [] as string[]);
  const mails = await Promise.all(files.sort().map(async (f) => JSON.parse(await readFile(join(env.outboxDir, f), 'utf8')) as Mail));
  return mails;
}

/** Thu duoc gui sau khi da tra 204, nen cho toi khi thu xuat hien (hoac het gio). */
async function waitForMails(count: number): Promise<Mail[]> {
  for (let i = 0; i < 40; i++) {
    const mails = await outbox();
    if (mails.length >= count) return mails;
    await sleep(50);
  }
  return outbox();
}

const tokenOf = (mail: Mail): string => /#token=([\w-]+)/.exec(mail.text)![1]!;

describe('Quen mat khau qua email', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await rm(env.outboxDir, { recursive: true, force: true });
  });
  beforeEach(async () => {
    await resetDb(app);
    await rm(env.outboxDir, { recursive: true, force: true });
  });

  const forgot = (email: string) => request(app.getHttpServer()).post('/api/auth/forgot-password').set('Origin', ORIGIN).send({ email });
  const reset = (token: string, newPassword: string) =>
    request(app.getHttpServer()).post('/api/auth/reset-password').set('Origin', ORIGIN).send({ token, newPassword });

  it('luon tra 204; chi gui thu cho tai khoan dang hoat dong; lien ket tu WEB_ORIGIN, token o fragment', async () => {
    const active = await createUser(app, 'client');
    const disabled = await createUser(app, 'client');
    await app.get<Db>(DB).update(users).set({ status: 'disabled' }).where(eq(users.id, disabled.id));

    expect((await forgot('khong-ton-tai@test.local')).status).toBe(204);
    expect((await forgot(disabled.email)).status).toBe(204);
    expect((await forgot(active.email)).status).toBe(204);
    expect((await forgot('khong-phai-email')).status).toBe(400);

    const mails = await waitForMails(1);
    await sleep(150); // dam bao khong co thu thu hai den muon
    expect(await outbox()).toHaveLength(1);
    expect(mails[0]!.to).toBe(active.email);
    const link = /https?:\/\/\S+/.exec(mails[0]!.text)![0];
    expect(link.startsWith(`${env.webOrigin}/reset-password#token=`)).toBe(true);
    expect(link).not.toContain('?'); // token khong nam trong query string
  });

  it('gioi han 3 yeu cau moi gio cho mot email; token chi luu dang bam', async () => {
    const u = await createUser(app, 'client');
    for (let i = 0; i < 5; i++) expect((await forgot(u.email)).status).toBe(204);
    await waitForMails(3);
    await sleep(300);
    const mails = await outbox();
    expect(mails).toHaveLength(3);
    const rows = await app.get<Db>(DB).select().from(passwordResetTokens);
    expect(rows).toHaveLength(3);
    for (const m of mails) expect(rows.some((r) => r.tokenHash === tokenOf(m))).toBe(false); // khong luu token tho
  });

  it('dat lai mat khau: dung duoc mot lan, huy phien, xoa khoa, khong ghi token vao nhat ky', async () => {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    const u = await createUser(app, 'client');
    const old = await loginAs(app, u);
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/api/auth/login').set('Origin', ORIGIN).send({ email: u.email, password: 'sai-mat-khau-1' });
    }
    await forgot(u.email);
    const token = tokenOf((await waitForMails(1))[0]!);

    expect((await reset(token, 'yeu')).status).toBe(400); // mat khau moi khong hop le
    expect((await reset('x'.repeat(43), 'MatKhauMoi123')).status).toBe(400); // token la
    expect((await reset(token, 'MatKhauMoi123')).status).toBe(204);
    expect((await reset(token, 'MatKhauKhac456')).status).toBe(400); // dung mot lan

    expect((await old.get('/api/auth/me')).status).toBe(401);
    const login = await request(app.getHttpServer()).post('/api/auth/login').set('Origin', ORIGIN).send({ email: u.email, password: 'MatKhauMoi123' });
    expect(login.status).toBe(200); // het khoa do dang nhap sai
    expect((await request(app.getHttpServer()).post('/api/auth/login').set('Origin', ORIGIN).send({ email: u.email, password: PASSWORD })).status).toBe(401);

    const logs = JSON.stringify((await admin.get('/api/admin/audit-logs?limit=50')).body);
    expect(logs).toContain('auth.reset_password');
    expect(logs).not.toContain(token);
  });

  it('token het hieu luc khi doi mat khau, khi quan tri cap mat khau tam, hoac khi tai khoan bi khoa', async () => {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    const a = await createUser(app, 'client');
    const b = await createUser(app, 'client');
    const c = await createUser(app, 'client');
    for (const u of [a, b, c]) await forgot(u.email);
    const mails = await waitForMails(3);
    const tokenFor = (email: string) => tokenOf(mails.find((m) => m.to === email)!);

    const agentA = await loginAs(app, a);
    expect((await agentA.post('/api/auth/change-password').set('Origin', ORIGIN).send({ currentPassword: a.password, newPassword: 'DoiMatKhau123' })).status).toBe(204);
    expect((await reset(tokenFor(a.email), 'KeTanCong12345')).status).toBe(400);

    expect((await admin.post(`/api/admin/users/${b.id}/reset-password`).set('Origin', ORIGIN)).status).toBe(200);
    expect((await reset(tokenFor(b.email), 'KeTanCong12345')).status).toBe(400);

    await app.get<Db>(DB).update(users).set({ status: 'disabled' }).where(eq(users.id, c.id));
    expect((await reset(tokenFor(c.email), 'KeTanCong12345')).status).toBe(400);
  });
});
