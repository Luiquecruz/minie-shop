import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { pino, type Logger } from 'pino';
import { AppModule } from './app.module.js';
import { assertChaosSafety, registerChaosHook } from './common/chaos.middleware.js';
import { GlobalExceptionFilter } from './common/global-exception.filter.js';
import { loadEnv, parseCorsOrigins, type Env } from './config/env.js';

export interface CreateAppResult {
  app: NestFastifyApplication;
  env: Env;
  logger: Logger;
}

export async function createApp(options?: { env?: Env }): Promise<CreateAppResult> {
  const env = options?.env ?? loadEnv();
  assertChaosSafety(env);

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

  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  await fastifyInstance.register(fastifyCors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-request-id',
      'x-chaos-delay',
      'x-chaos-fail',
      'x-chaos-status',
    ],
    exposedHeaders: ['x-request-id', 'etag'],
  });

  await fastifyInstance.register(fastifyCookie, {
    secret: env.COOKIE_SECRET,
  });

  registerChaosHook(fastifyInstance, env, logger);

  fastifyInstance.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: ['error', 'warn'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  return { app, env, logger };
}
