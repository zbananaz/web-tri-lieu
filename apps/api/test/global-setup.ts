// Chay mot lan truoc toan bo test: migrate database TEST. Bat buoc NODE_ENV=test de khong cham vao DB phat trien.
export default async function setup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  const { env } = await import('../src/config/env.js');
  if (!/_test(\?|$)/.test(env.databaseUrl)) {
    throw new Error('Tu choi chay test: database khong phai database test (ten phai ket thuc bang _test).');
  }
  const { runMigrations } = await import('../src/db/migrate.js');
  await runMigrations();
}
