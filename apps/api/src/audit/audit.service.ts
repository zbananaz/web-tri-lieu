import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { DB } from '../db/db.module.js';
import type { Db } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Ghi nhat ky. Khong bao gio dua mat khau/token/noi dung chat vao meta. */
  async log(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLogs).values({
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      ip: entry.ip ?? null,
      meta: entry.meta ?? null,
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
