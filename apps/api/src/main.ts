import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { pino } from 'pino';
import { loadEnv } from './config/env.js';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const logger = pino({
    level: env.LOG_LEVEL,
    base: { service: 'minieshop-api', env: env.NODE_ENV },
  });

  const adapter = new FastifyAdapter({
    loggerInstance: logger,
    requestIdHeader: 'x-request-id',
    genReqId: (req: IncomingMessage) => {
      const incoming = req.headers['x-request-id'];
      if (typeof incoming === 'string' && incoming.trim().length > 0) {
        return incoming.trim();
      }
      return randomUUID();
    },
  });

  const fastifyInstance = adapter.getInstance();
  fastifyInstance.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: ['error', 'warn'],
  });

  app.enableShutdownHooks();

  await app.listen(env.PORT, env.HOST);
  logger.info({ port: env.PORT, host: env.HOST }, 'API server listening');
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[boot] Failed to start API:\n${message}`);
  process.exit(1);
});
