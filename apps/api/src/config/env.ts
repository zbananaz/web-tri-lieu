import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

// Tim .env o thu muc goc monorepo (di nguoc len tu thu muc hien tai).
function loadDotenv(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, '.env')) && dirname(dir) !== dir) dir = dirname(dir);
  const file = join(dir, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
  return dir;
}
const rootDir = loadDotenv();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().optional(),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  SESSION_TTL_DAYS: z.coerce.number().int().default(14),
  HOTLINES: z.string().default('115:Cấp cứu y tế,111:Tổng đài bảo vệ trẻ em'),
  SEED_PASSWORD: z.string().optional(),
  // So lop proxy tin cay truoc API (de lay IP that cho rate limit / nhat ky). Mac dinh production: 2 = Next + reverse proxy (nginx/Caddy).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).optional(),
  // Gioi han dang nhap/dang ky moi phut moi IP. Giu 20 o production; chi nang len khi chay bo e2e (hon 20 lan dang nhap/phut tu mot may).
  RATE_LIMIT_PER_MIN: z.coerce.number().int().min(30).max(100_000).default(120),
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(5).max(10_000).default(20),
  // Thu muc luu anh tai len (mac dinh <goc repo>/data/uploads, nam o o D cung repo). Dat ra o dia rieng khi len production.
  UPLOAD_DIR: z.string().min(1).optional(),
  // Gui thu qua SMTP (vd smtps://user:pass@smtp.example.com). De trong: dev/test ghi thu ra data/outbox; production tu choi gui.
  SMTP_URL: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(3).default('Tri Lieu <no-reply@localhost>'),
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
  authRateLimitPerMin: parsed.AUTH_RATE_LIMIT_PER_MIN,
  rateLimitPerMin: parsed.RATE_LIMIT_PER_MIN,
  uploadDir: parsed.UPLOAD_DIR ?? join(rootDir, 'data', parsed.NODE_ENV === 'test' ? 'uploads-test' : 'uploads'),
  smtpUrl: parsed.SMTP_URL,
  mailFrom: parsed.MAIL_FROM,
  outboxDir: join(rootDir, 'data', parsed.NODE_ENV === 'test' ? 'outbox-test' : 'outbox'),
  trustProxyHops: parsed.TRUST_PROXY_HOPS ?? (parsed.NODE_ENV === 'production' ? 2 : 0),
  hotlines: parsed.HOTLINES.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [number, ...rest] = s.split(':');
      return { number: number!.trim(), label: rest.join(':').trim() };
    }),
};
