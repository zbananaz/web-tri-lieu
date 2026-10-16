import { eq } from 'drizzle-orm';
import { generateTempPassword, hashPassword } from '../auth/password.js';
import { createDb, createPool } from './client.js';
import { SPECIALTIES } from './seed.js';
import { auditLogs, specialties, users } from './schema.js';

// Khoi tao production (seed bi chan o production): tao 1 tai khoan quan tri + danh muc linh vuc (khong co du lieu mau).
// Chay tren may co quyen truy cap DB. Dung: pnpm --filter "@wtl/api" admin:create <email> "<Ho ten>"
const email = process.argv[2]?.trim().toLowerCase();
const fullName = process.argv[3]?.trim();
if (!email || !fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Dung: pnpm --filter "@wtl/api" admin:create <email> "<Ho ten>"');
  process.exit(1);
}

const pool = createPool();
const db = createDb(pool);
try {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.error('Email nay da co tai khoan. Neu quen mat khau, dung admin:reset-password.');
    process.exit(1);
  }
  await db.insert(specialties).values(SPECIALTIES).onConflictDoNothing();
  const temp = generateTempPassword();
  const [u] = await db
    .insert(users)
    .values({ email, fullName, role: 'admin', passwordHash: await hashPassword(temp), mustChangePassword: true })
    .returning({ id: users.id });
  await db.insert(auditLogs).values({ actorId: null, action: 'user.create_admin_cli', entity: 'user', entityId: u!.id });
  console.log(`Da tao quan tri ${email}. Mat khau tam (hien mot lan, phai doi khi dang nhap):`);
  console.log(`  ${temp}`);
} finally {
  await pool.end();
}
