import { env } from '../config/env.js';
import { createDb, createPool } from './client.js';
import { SEED_ACCOUNTS, seed } from './seed.js';

if (env.isProd) {
  console.error('Khong chay seed o moi truong production.');
  process.exit(1);
}
if (!env.seedPassword || env.seedPassword.length < 10) {
  console.error('Can dat SEED_PASSWORD (>= 10 ky tu) trong .env');
  process.exit(1);
}

const pool = createPool();
await seed(createDb(pool), env.seedPassword);
await pool.end();
console.log('Seed xong. Tai khoan (mat khau = SEED_PASSWORD trong .env):');
console.log(`  admin:      ${SEED_ACCOUNTS.admin}`);
console.log(`  chuyen gia: ${SEED_ACCOUNTS.experts.join(', ')}`);
console.log(`  khach:      ${SEED_ACCOUNTS.client}`);
