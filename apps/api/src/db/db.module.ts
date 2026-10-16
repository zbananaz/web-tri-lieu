import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';
import { createDb, createPool } from './client.js';

export const POOL = Symbol('POOL');
export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    { provide: POOL, useFactory: () => createPool() },
    { provide: DB, useFactory: (pool: Pool) => createDb(pool), inject: [POOL] },
  ],
  exports: [POOL, DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
