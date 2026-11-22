import 'reflect-metadata';
import { createServer } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { pino } from 'pino';
import { AppModule } from '../app.module.js';
import { loadEnv } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { OutboxService } from '../modules/platform/index.js';
import { OutboxWorkerRunner, type OutboxEventHandler } from './worker.runner.js';

async function bootstrapWorker(): Promise<void> {
  const env = loadEnv();
  const logger = pino({
    level: env.LOG_LEVEL,
    base: { service: 'minieshop-worker', env: env.NODE_ENV },
  });

  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const outboxService = appContext.get(OutboxService);
  const databaseService = appContext.get(DatabaseService);

  const handlers: Record<string, OutboxEventHandler> = {
    noop: async () => {
      // Built-in smoke/heartbeat consumer
    },
  };

  const runner = new OutboxWorkerRunner({
    outboxService,
    handlers,
    logger,
    batchSize: env.WORKER_BATCH_SIZE,
    leaseMs: env.WORKER_LEASE_MS,
    maxAttempts: env.WORKER_MAX_ATTEMPTS,
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    retentionDays: env.OUTBOX_RETENTION_DAYS,
  });

  const healthServer = createServer(async (req, res) => {
    if (req.url === '/health') {
      const dbOk = await databaseService.checkConnection();
      res.writeHead(dbOk ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: dbOk ? 'ok' : 'unhealthy',
          lastHeartbeat: runner.getLastHeartbeat().toISOString(),
        }),
      );
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise<void>((resolve) => {
    healthServer.listen(env.WORKER_HEALTH_PORT, env.HOST, () => resolve());
  });

  runner.start();
  logger.info(
    { healthPort: env.WORKER_HEALTH_PORT, consumers: Object.keys(handlers) },
    'Outbox worker started',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown initiated for worker');
    await runner.stop();
    await new Promise<void>((resolve) => healthServer.close(() => resolve()));
    await appContext.close();
    logger.info('Worker shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrapWorker().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[worker] Failed to start:\n${message}`);
  process.exit(1);
});
