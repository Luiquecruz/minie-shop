import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { AuditLogEntryDTO, AuditLogQuery, AuditLogResponseDTO } from '@minieshop/contracts';
import { validationError } from '../../common/errors.js';
import { redactSensitiveData } from '../../common/logger.js';
import { DatabaseService } from '../../database/database.service.js';
import { auditLog } from '../../database/schema/platform.js';
import type { DbOrTx } from './outbox.service.js';

export type AuditActorType = 'system' | 'customer' | 'staff';

export interface AuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditRecordInput {
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  context?: AuditContext;
}

interface DecodedAuditCursor {
  createdAt: string;
  id: string;
}

function encodeAuditCursor(cursor: DecodedAuditCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeAuditCursor(raw: string): DecodedAuditCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.createdAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.createdAt)) ||
      typeof parsed.id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(parsed.id)
    ) {
      throw new Error('Malformed cursor');
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw validationError([{ path: 'cursor', message: 'Invalid audit log cursor' }]);
  }
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async record(tx: DbOrTx, input: AuditRecordInput): Promise<string> {
    const redactedBefore =
      input.before !== undefined && input.before !== null
        ? redactSensitiveData(input.before)
        : null;
    const redactedAfter =
      input.after !== undefined && input.after !== null
        ? redactSensitiveData(input.after)
        : null;
    const redactedMetadata = input.metadata ? redactSensitiveData(input.metadata) : {};

    const [inserted] = await tx
      .insert(auditLog)
      .values({
        actorType: input.actorType,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: redactedBefore,
        afterState: redactedAfter,
        ipAddress: input.context?.ipAddress ?? null,
        userAgent: input.context?.userAgent ?? null,
        requestId: input.context?.requestId ?? null,
        metadata: redactedMetadata,
      })
      .returning({ id: auditLog.id });

    if (!inserted) {
      throw new Error('Failed to record audit log entry');
    }

    return inserted.id;
  }

  async recordStandalone(input: AuditRecordInput): Promise<string> {
    return this.record(this.databaseService.db, input);
  }

  async queryLogs(query: AuditLogQuery): Promise<AuditLogResponseDTO> {
    const conditions: SQL[] = [];

    if (query.actorType) {
      conditions.push(eq(auditLog.actorType, query.actorType));
    }
    if (query.actorId) {
      conditions.push(eq(auditLog.actorId, query.actorId));
    }
    if (query.action) {
      conditions.push(eq(auditLog.action, query.action));
    }
    if (query.from) {
      conditions.push(gte(auditLog.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(auditLog.createdAt, new Date(query.to)));
    }
    if (query.cursor) {
      const decoded = decodeAuditCursor(query.cursor);
      conditions.push(
        sql`(${auditLog.createdAt} < ${decoded.createdAt}::timestamptz OR (${auditLog.createdAt} = ${decoded.createdAt}::timestamptz AND ${auditLog.id} < ${decoded.id}::uuid))`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await this.databaseService.db
      .select()
      .from(auditLog)
      .where(whereClause)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    const items: AuditLogEntryDTO[] = pageRows.map((row) => ({
      id: row.id,
      actorType: row.actorType as AuditActorType,
      actorId: row.actorId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.beforeState ?? null,
      after: row.afterState ?? null,
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      requestId: row.requestId ?? null,
      metadata: row.metadata ?? {},
      createdAt: row.createdAt.toISOString(),
    }));

    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeAuditCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    return { items, nextCursor };
  }
}
