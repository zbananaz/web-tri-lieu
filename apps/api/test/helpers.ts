import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Role } from '@wtl/shared';
import type { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.factory.js';
import { hashPassword } from '../src/auth/password.js';
import { env } from '../src/config/env.js';
import type { Db } from '../src/db/client.js';
import { DB, POOL } from '../src/db/db.module.js';
import { users } from '../src/db/schema.js';

export const ORIGIN = env.webOrigin;
export const PASSWORD = 'Matkhau12345';

export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app); // dung dung lop bao mat that (helmet, cookie, kiem tra Origin...)
  await app.init();
  return app;
}

/** Xoa sach du lieu cac bang (chi cho phep tren database test). */
export async function resetDb(app: NestExpressApplication): Promise<void> {
  if (!/_test(\?|$)/.test(env.databaseUrl)) throw new Error('Chi duoc reset database test');
  const pool = app.get<Pool>(POOL);
  const { rows } = await pool.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public'");
  const names = rows.map((r) => `"${r.tablename}"`).join(', ');
  await pool.query(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
}

let counter = 0;
const hashPromise = hashPassword(PASSWORD);

export interface TestUser {
  id: string;
  email: string;
  role: Role;
  password: string;
}

export async function createUser(
  app: NestExpressApplication,
  role: Role,
  overrides: Partial<{ email: string; fullName: string; phone: string }> = {},
): Promise<TestUser> {
  const db = app.get<Db>(DB);
  const email = overrides.email ?? `${role}${++counter}@test.local`;
  const [row] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPromise,
      role,
      fullName: overrides.fullName ?? `Test ${role} ${counter}`,
      phone: overrides.phone ?? '0900000000',
    })
    .returning({ id: users.id });
  return { id: row!.id, email, role, password: PASSWORD };
}

/** Agent da dang nhap (giu cookie phien). Moi request doi du lieu phai gui Origin hop le, giong trinh duyet that. */
export async function loginAs(app: NestExpressApplication, user: Pick<TestUser, 'email' | 'password'>) {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email: user.email, password: user.password });
  if (res.status !== 200) throw new Error(`Dang nhap that bai: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export type Agent = Awaited<ReturnType<typeof loginAs>>;
export { request };
