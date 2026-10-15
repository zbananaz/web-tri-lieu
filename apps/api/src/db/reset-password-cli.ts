import { eq } from 'drizzle-orm';
import { generateTempPassword, hashPassword } from '../auth/password.js';
import { createDb, createPool } from './client.js';
import { auditLogs, passwordResetTokens, sessions, users } from './schema.js';

// Khoi phuc khi quan tri vien (ke ca quan tri duy nhat) quen mat khau: chay tren may chu, can quyen truy cap DB.
// Dung: pnpm --filter "@wtl/api" admin:reset-password <email>
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Dung: pnpm --filter "@wtl/api" admin:reset-password <email>');
  process.exit(1);
}

const pool = createPool();
const db = createDb(pool);
const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
if (!u) {
  console.error('Khong tim thay tai khoan voi email nay.');
  await pool.end();
  process.exit(1);
}
const temp = generateTempPassword();
await db
  .update(users)
  .set({ passwordHash: await hashPassword(temp), mustChangePassword: true, failedLogins: 0, lockedUntil: null, updatedAt: new Date() })
  .where(eq(users.id, u.id));
await db.delete(sessions).where(eq(sessions.userId, u.id));
await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, u.id));
await db.insert(auditLogs).values({ actorId: null, action: 'user.reset_password_cli', entity: 'user', entityId: u.id });
await pool.end();
console.log(`Da dat mat khau tam cho ${email} (hien mot lan, phai doi khi dang nhap):`);
console.log(`  ${temp}`);
