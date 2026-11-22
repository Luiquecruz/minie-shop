import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, inArray, lt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DatabaseService } from '../../database/database.service.js';
import * as schema from '../../database/schema/index.js';
import { outbox } from '../../database/schema/index.js';
import {
  OUTBOX_SUBSCRIPTIONS,
  type OutboxConsumer,
  type OutboxEventInput,
  type OutboxRecord,
  type OutboxStatus,
} from './outbox-events.js';

export type DbOrTx = Pick<NodePgDatabase<typeof schema>, 'insert' | 'select' | 'update' | 'delete' | 'execute'>;

export interface OutboxStatsRow {
  status: string;
  consumer: string;
  total: number;
}

@Injectable()
export class OutboxService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async enqueue(tx: DbOrTx, event: OutboxEventInput): Promise<string[]> {
    return this.enqueueBatch(tx, [event]);
  }

  async enqueueBatch(tx: DbOrTx, events: OutboxEventInput[]): Promise<string[]> {
    const rowsToInsert: Array<{
      eventType: string;
      consumer: string;
      aggregateType: string;
      aggregateId: string;
      payload: Record<string, unknown>;
    }> = [];

    for (const event of events) {
      const consumers: readonly OutboxConsumer[] =
        event.consumers && event.consumers.length > 0
          ? event.consumers
          : OUTBOX_SUBSCRIPTIONS[event.eventType];

      for (const consumer of consumers) {
        rowsToInsert.push({
          eventType: event.eventType,
          consumer,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: event.payload,
        });
      }
    }

    if (rowsToInsert.length === 0) {
      return [];
    }

    const inserted = await tx
      .insert(outbox)
      .values(rowsToInsert)
      .returning({ id: outbox.id });

    return inserted.map((row) => row.id);
  }

  async claimBatch(params: {
    batchSize: number;
    leaseMs: number;
    consumers?: string[];
  }): Promise<OutboxRecord[]> {
    const { batchSize, leaseMs, consumers } = params;

    return this.databaseService.db.transaction(async (tx) => {
      const consumerFilter =
        consumers && consumers.length > 0
          ? sql`AND consumer IN (${sql.join(
              consumers.map((c) => sql`${c}`),
              sql`, `,
            )})`
          : sql``;

      const result = await tx.execute<{
        id: string;
        event_type: string;
        consumer: string;
        aggregate_type: string;
        aggregate_id: string;
        payload: Record<string, unknown>;
        created_at: Date;
        available_at: Date;
        attempts: number;
        last_error: string | null;
        locked_until: Date | null;
        processed_at: Date | null;
        status: OutboxStatus;
      }>(sql`
        WITH candidates AS (
          SELECT id
          FROM "platform"."outbox"
          WHERE status = 'pending'
            AND available_at <= now()
            AND (locked_until IS NULL OR locked_until <= now())
            ${consumerFilter}
          ORDER BY available_at ASC, id ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "platform"."outbox" AS o
        SET
          locked_until = now() + (${leaseMs} * interval '1 millisecond'),
          attempts = o.attempts + 1
        FROM candidates
        WHERE o.id = candidates.id
        RETURNING
          o.id,
          o.event_type,
          o.consumer,
          o.aggregate_type,
          o.aggregate_id,
          o.payload,
          o.created_at,
          o.available_at,
          o.attempts,
          o.last_error,
          o.locked_until,
          o.processed_at,
          o.status
      `);

      return result.rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        consumer: row.consumer,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        payload: row.payload ?? {},
        createdAt: new Date(row.created_at),
        availableAt: new Date(row.available_at),
        attempts: Number(row.attempts),
        lastError: row.last_error,
        lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
        processedAt: row.processed_at ? new Date(row.processed_at) : null,
        status: row.status,
      }));
    });
  }

  async markProcessed(id: string): Promise<void> {
    await this.databaseService.db
      .update(outbox)
      .set({
        status: 'processed',
        processedAt: new Date(),
        lockedUntil: null,
        lastError: null,
      })
      .where(eq(outbox.id, id));
  }

  async markFailed(params: {
    id: string;
    attempts: number;
    maxAttempts: number;
    errorMessage: string;
    baseBackoffMs: number;
  }): Promise<'pending' | 'dead'> {
    const { id, attempts, maxAttempts, errorMessage, baseBackoffMs } = params;
    const truncatedError = errorMessage.slice(0, 2000);

    if (attempts >= maxAttempts) {
      await this.databaseService.db
        .update(outbox)
        .set({
          status: 'dead',
          lockedUntil: null,
          lastError: truncatedError,
        })
        .where(eq(outbox.id, id));
      return 'dead';
    }

    const expDelay = baseBackoffMs * 2 ** Math.max(0, attempts - 1);
    const jitterFactor = 0.75 + Math.random() * 0.5;
    const delayMs = Math.min(300_000, Math.round(expDelay * jitterFactor));
    const nextAvailableAt = new Date(Date.now() + delayMs);

    await this.databaseService.db
      .update(outbox)
      .set({
        status: 'pending',
        availableAt: nextAvailableAt,
        lockedUntil: null,
        lastError: truncatedError,
      })
      .where(eq(outbox.id, id));

    return 'pending';
  }

  async cleanupProcessed(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const deleted = await this.databaseService.db
      .delete(outbox)
      .where(and(eq(outbox.status, 'processed'), lt(outbox.processedAt, cutoff)))
      .returning({ id: outbox.id });
    return deleted.length;
  }

  async getStats(): Promise<OutboxStatsRow[]> {
    const rows = await this.databaseService.db
      .select({
        status: outbox.status,
        consumer: outbox.consumer,
        total: count(),
      })
      .from(outbox)
      .groupBy(outbox.status, outbox.consumer);

    return rows.map((row) => ({
      status: row.status,
      consumer: row.consumer,
      total: Number(row.total),
    }));
  }

  async requeue(params: { id?: string; dead?: boolean }): Promise<number> {
    const condition = params.dead
      ? eq(outbox.status, 'dead')
      : params.id
        ? eq(outbox.id, params.id)
        : undefined;

    if (!condition) {
      throw new Error('Either id or dead=true must be provided to requeue');
    }

    const updated = await this.databaseService.db
      .update(outbox)
      .set({
        status: 'pending',
        attempts: 0,
        availableAt: new Date(),
        lockedUntil: null,
        lastError: null,
        processedAt: null,
      })
      .where(condition)
      .returning({ id: outbox.id });

    return updated.length;
  }

  async countPending(consumers?: string[]): Promise<number> {
    const conditions = [eq(outbox.status, 'pending')];
    if (consumers && consumers.length > 0) {
      conditions.push(inArray(outbox.consumer, consumers));
    }

    const [row] = await this.databaseService.db
      .select({ total: count() })
      .from(outbox)
      .where(and(...conditions));

    return Number(row?.total ?? 0);
  }

  async waitDrain(options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    consumers?: string[];
  }): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? 60_000;
    const pollIntervalMs = options?.pollIntervalMs ?? 250;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      const pending = await this.countPending(options?.consumers);
      if (pending === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    const remaining = await this.countPending(options?.consumers);
    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for outbox to drain (${remaining} pending events remaining)`,
    );
  }
}
