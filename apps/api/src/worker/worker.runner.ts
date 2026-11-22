import type { Logger } from 'pino';
import { OutboxService, type OutboxRecord } from '../modules/platform/index.js';

export type OutboxEventHandler = (event: OutboxRecord) => Promise<void>;

export interface WorkerRunnerOptions {
  outboxService: OutboxService;
  handlers: Record<string, OutboxEventHandler>;
  logger: Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;
  batchSize?: number;
  leaseMs?: number;
  maxAttempts?: number;
  baseBackoffMs?: number;
  pollIntervalMs?: number;
  retentionDays?: number;
  cleanupIntervalMs?: number;
}

export class OutboxWorkerRunner {
  private readonly outboxService: OutboxService;
  private readonly handlers: Record<string, OutboxEventHandler>;
  private readonly logger: Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;
  private readonly batchSize: number;
  private readonly leaseMs: number;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly pollIntervalMs: number;
  private readonly retentionDays: number;
  private readonly cleanupIntervalMs: number;

  private running = false;
  private lastHeartbeat = new Date();
  private lastCleanupAt = 0;
  private loopPromise: Promise<void> | null = null;

  constructor(options: WorkerRunnerOptions) {
    this.outboxService = options.outboxService;
    this.handlers = options.handlers;
    this.logger = options.logger;
    this.batchSize = options.batchSize ?? 20;
    this.leaseMs = options.leaseMs ?? 30_000;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseBackoffMs = options.baseBackoffMs ?? 1_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 500;
    this.retentionDays = options.retentionDays ?? 7;
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60 * 60 * 1_000;
  }

  getLastHeartbeat(): Date {
    return this.lastHeartbeat;
  }

  async processNextBatch(): Promise<number> {
    const consumers = Object.keys(this.handlers);
    if (consumers.length === 0) {
      return 0;
    }

    const claimed = await this.outboxService.claimBatch({
      batchSize: this.batchSize,
      leaseMs: this.leaseMs,
      consumers,
    });

    this.lastHeartbeat = new Date();

    for (const event of claimed) {
      const handler = this.handlers[event.consumer];
      if (!handler) {
        await this.outboxService.markFailed({
          id: event.id,
          attempts: event.attempts,
          maxAttempts: this.maxAttempts,
          errorMessage: `No handler registered for consumer "${event.consumer}"`,
          baseBackoffMs: this.baseBackoffMs,
        });
        continue;
      }

      try {
        await handler(event);
        await this.outboxService.markProcessed(event.id);
        this.logger.info(
          {
            eventId: event.id,
            eventType: event.eventType,
            consumer: event.consumer,
            aggregateId: event.aggregateId,
            attempts: event.attempts,
          },
          'Outbox event processed',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const nextStatus = await this.outboxService.markFailed({
          id: event.id,
          attempts: event.attempts,
          maxAttempts: this.maxAttempts,
          errorMessage: message,
          baseBackoffMs: this.baseBackoffMs,
        });
        this.logger.error(
          {
            eventId: event.id,
            eventType: event.eventType,
            consumer: event.consumer,
            aggregateId: event.aggregateId,
            attempts: event.attempts,
            nextStatus,
            err: message,
          },
          'Outbox event processing failed',
        );
      }
    }

    return claimed.length;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.loopPromise = this.runLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.loopPromise) {
      await this.loopPromise;
      this.loopPromise = null;
    }
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        const processedCount = await this.processNextBatch();

        const now = Date.now();
        if (now - this.lastCleanupAt >= this.cleanupIntervalMs) {
          this.lastCleanupAt = now;
          const deleted = await this.outboxService.cleanupProcessed(this.retentionDays);
          if (deleted > 0) {
            this.logger.info(
              { deleted, retentionDays: this.retentionDays },
              'Cleaned up old processed outbox events',
            );
          }
        }

        if (processedCount === 0 && this.running) {
          await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error({ err: message }, 'Worker polling iteration failed');
        if (this.running) {
          await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
        }
      }
    }
  }
}
