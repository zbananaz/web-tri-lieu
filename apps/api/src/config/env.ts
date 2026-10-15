import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

// Tim .env o thu muc goc monorepo (di nguoc len tu thu muc hien tai).
function loadDotenv(): void {
  let dir = process.cwd();
  while (!existsSync(join(dir, '.env')) && dirname(dir) !== dir) dir = dirname(dir);
  const file = join(dir, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}
loadDotenv();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().optional(),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  SESSION_TTL_DAYS: z.coerce.number().int().default(14),
  HOTLINES: z.string().default('115:Cấp cứu y tế,111:Tổng đài bảo vệ trẻ em'),
  SEED_PASSWORD: z.string().optional(),
});

const parsed = schema.parse(process.env);

// Test khong bao gio duoc cham vao database phat trien.
const databaseUrl = parsed.NODE_ENV === 'test' ? parsed.TEST_DATABASE_URL : parsed.DATABASE_URL;
if (!databaseUrl) throw new Error('Thieu TEST_DATABASE_URL (bat buoc khi chay test).');

export const env = {
  nodeEnv: parsed.NODE_ENV,
  isProd: parsed.NODE_ENV === 'production',
  databaseUrl,
  apiPort: parsed.API_PORT,
  webOrigin: parsed.WEB_ORIGIN,
  sessionTtlDays: parsed.SESSION_TTL_DAYS,
  seedPassword: parsed.SEED_PASSWORD,
  hotlines: parsed.HOTLINES.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [number, ...rest] = s.split(':');
      return { number: number!.trim(), label: rest.join(':').trim() };
    }),
};
