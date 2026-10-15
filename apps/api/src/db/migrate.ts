import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { createDb, createPool } from './client.js';

export async function runMigrations(): Promise<void> {
  const pool = createPool();
  try {
    await migrate(createDb(pool), { migrationsFolder: join(process.cwd(), 'drizzle') });
  } finally {
    await pool.end();
  }
}
