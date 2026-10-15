import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

export function createPool(): pg.Pool {
  return new pg.Pool({ connectionString: env.databaseUrl, max: 10 });
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { schema };
