import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import type { DestinationStream, Logger } from 'pino';
import { AppModule } from './app.module.js';
import { assertChaosSafety, registerChaosHook } from './common/chaos.middleware.js';
import { GlobalExceptionFilter } from './common/global-exception.filter.js';
import { createAppLogger } from './common/logger.js';
import { assertSecurityConfig, loadEnv, parseCorsOrigins, type Env } from './config/env.js';

export interface CreateAppResult {
  app: NestFastifyApplication;
  env: Env;
  logger: Logger;
}

const NO_STORE_PREFIXES = ['/me', '/auth', '/admin'];

function shouldApplyNoStore(urlPath: string): boolean {
  const path = urlPath.split('?')[0] ?? urlPath;
  return NO_STORE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export async function createApp(options?: {
  env?: Env;
  loggerDestination?: DestinationStream;
}): Promise<CreateAppResult> {
  const env = options?.env ?? loadEnv();
  assertChaosSafety(env);
  assertSecurityConfig(env);

  const logger = createAppLogger(env, 'minieshop-api', options?.loggerDestination);

  const adapter = new FastifyAdapter({
    loggerInstance: logger,
    trustProxy: env.TRUST_PROXY,
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

  await fastifyInstance.register(fastifyHelmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: env.COOKIE_SECURE
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      : false,
    referrerPolicy: { policy: 'no-referrer' },
  });

  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  await fastifyInstance.register(fastifyCors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-request-id',
      'x-csrf-token',
      'x-chaos-delay',
      'x-chaos-fail',
      'x-chaos-status',
    ],
    exposedHeaders: ['x-request-id', 'etag', 'retry-after'],
  });

  await fastifyInstance.register(fastifyCookie, {
    secret: env.COOKIE_SECRET,
  });

  registerChaosHook(fastifyInstance, env, logger);

  fastifyInstance.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
    reply.removeHeader('x-powered-by');
    reply.removeHeader('server');
    if (shouldApplyNoStore(request.url)) {
      void reply.header('cache-control', 'no-store');
    }
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: ['error', 'warn'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  return { app, env, logger };
}
