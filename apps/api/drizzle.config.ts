import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// Tim .env o thu muc goc monorepo (di nguoc len tu thu muc hien tai).
let dir = process.cwd();
while (!existsSync(join(dir, '.env')) && dirname(dir) !== dir) dir = dirname(dir);
if (existsSync(join(dir, '.env'))) process.loadEnvFile(join(dir, '.env'));

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
