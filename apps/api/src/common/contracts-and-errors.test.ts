import 'reflect-metadata';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCors from '@fastify/cors';
import {
  apiErrorResponseSchema,
  categoryDtoSchema,
  facetsDtoSchema,
  favoriteCreatedResponseSchema,
  favoritesListResponseSchema,
  productCardDtoSchema,
  productDetailDtoSchema,
  productListResponseSchema,
} from '@minieshop/contracts';
import { z } from 'zod';
import { GlobalExceptionFilter } from './global-exception.filter.js';
import { parseOutput } from './parse-response.js';
import { AppHttpError } from './errors.js';

@Controller('test-errors')
class TestErrorsController {
  @Get('zod')
  triggerZod(): void {
    z.object({ limit: z.number().int().max(60) }).parse({ limit: 999 });
  }

  @Get('unhandled')
  triggerUnhandled(): void {
    throw new Error('Sensitive DB stack trace detail should never leak');
  }

  @Get('leak')
  triggerLeak(): unknown {
    return parseOutput(favoriteCreatedResponseSchema, {
      favorited: true,
      internalSecretColumn: 'leaked',
    });
  }
}

@Module({
  controllers: [TestErrorsController],
})
class TestErrorsModule {}

describe('T11 — Public Contracts (.strict() leak guard) & Standardized Errors', () => {
  const sampleUuid = '11111111-1111-4111-8111-111111111111';

  it('rejects any extra field on every public output schema (.strict() leak detection)', () => {
    const validImage = {
      id: sampleUuid,
      alt: 'Headphones',
      width: 1200,
      height: 800,
      placeholder: 'data:image/webp;base64,AAAA',
      variants: [
        {
          name: 'thumb',
          url: 'http://localhost:8333/minieshop-catalog-public/products/p/a/thumb.webp',
          width: 200,
          height: 133,
        },
      ],
    };

    const validCard = {
      id: sampleUuid,
      slug: 'fone-pro',
      name: 'Fone Pro',
      price: { amount: 29990, currency: 'BRL' },
      inStock: true,
      image: validImage,
      highlights: [{ code: 'battery_hours', label: 'Autonomia', value: 40, unit: 'h' }],
      categorySlug: 'audio',
    };

    const validDetail = {
      id: sampleUuid,
      slug: 'fone-pro',
      name: 'Fone Pro',
      description: 'Desc',
      price: { amount: 29990, currency: 'BRL' },
      inStock: true,
      category: { slug: 'audio', name: 'Áudio' },
      breadcrumbs: [
        { slug: 'eletronicos', name: 'Eletrônicos' },
        { slug: 'audio', name: 'Áudio' },
      ],
      images: [validImage],
      attributes: [{ code: 'battery_hours', label: 'Autonomia', value: 40, unit: 'h' }],
    };

    const validCategory = {
      id: sampleUuid,
      slug: 'eletronicos',
      name: 'Eletrônicos',
      productCount: 11,
      children: [],
    };

    const validFacets = {
      price: { min: 1000, max: 50000 },
      categories: [{ slug: 'audio', name: 'Áudio', count: 3 }],
      attributes: [
        {
          code: 'material',
          label: 'Material',
          type: 'enum' as const,
          options: [{ value: 'Alumínio', count: 2 }],
        },
      ],
    };

    assert.doesNotThrow(() => parseOutput(productCardDtoSchema, validCard));
    assert.doesNotThrow(() => parseOutput(productDetailDtoSchema, validDetail));
    assert.doesNotThrow(() => parseOutput(categoryDtoSchema, validCategory));
    assert.doesNotThrow(() => parseOutput(facetsDtoSchema, validFacets));
    assert.doesNotThrow(() =>
      parseOutput(productListResponseSchema, { items: [validCard], nextCursor: null }),
    );
    assert.doesNotThrow(() =>
      parseOutput(favoritesListResponseSchema, { productIds: [sampleUuid] }),
    );

    // Every schema must reject an extra leaked field
    assert.throws(
      () => parseOutput(productCardDtoSchema, { ...validCard, regularPriceCents: 39990 }),
      AppHttpError,
    );
    assert.throws(
      () => parseOutput(productDetailDtoSchema, { ...validDetail, sku: 'MS-00001' }),
      AppHttpError,
    );
    assert.throws(
      () => parseOutput(categoryDtoSchema, { ...validCategory, sortOrder: 1 }),
      AppHttpError,
    );
    assert.throws(
      () => parseOutput(facetsDtoSchema, { ...validFacets, extra: true }),
      AppHttpError,
    );
    assert.throws(
      () =>
        parseOutput(productListResponseSchema, {
          items: [validCard],
          nextCursor: null,
          total: 30,
        }),
      AppHttpError,
    );
    assert.throws(
      () => parseOutput(favoritesListResponseSchema, { productIds: [], sessionId: 'secret' }),
      AppHttpError,
    );
  });

  describe('GlobalExceptionFilter, NotFoundHandler & CORS', () => {
    let app: NestFastifyApplication;

    before(async () => {
      const adapter = new FastifyAdapter({
        genReqId: () => 'req-test-123',
      });
      const fastify = adapter.getInstance();

      await fastify.register(fastifyCors, {
        origin: ['http://localhost:5199'],
        credentials: true,
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'content-type',
          'x-request-id',
          'x-chaos-delay',
          'x-chaos-fail',
          'x-chaos-status',
        ],
      });

      app = await NestFactory.create<NestFastifyApplication>(TestErrorsModule, adapter, {
        logger: false,
      });
      app.useGlobalFilters(new GlobalExceptionFilter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    after(async () => {
      await app.close();
    });

    it('returns standardized 404 for unknown routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
      assert.equal(res.statusCode, 404);
      const body = apiErrorResponseSchema.parse(res.json());
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.equal(body.error.requestId, 'req-test-123');
    });

    it('maps ZodError to 400 VALIDATION_ERROR with per-field details', async () => {
      const res = await app.inject({ method: 'GET', url: '/test-errors/zod' });
      assert.equal(res.statusCode, 400);
      const body = apiErrorResponseSchema.parse(res.json());
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.ok(body.error.details && body.error.details.length === 1);
      assert.equal(body.error.details[0]?.path, 'limit');
    });

    it('masks unhandled errors as 500 INTERNAL_ERROR without leaking stack trace', async () => {
      const res = await app.inject({ method: 'GET', url: '/test-errors/unhandled' });
      assert.equal(res.statusCode, 500);
      const body = apiErrorResponseSchema.parse(res.json());
      assert.equal(body.error.code, 'INTERNAL_ERROR');
      assert.equal(body.error.message, 'Internal server error');
      assert.equal(res.body.includes('Sensitive DB stack trace'), false);
    });

    it('fails with 500 when a mapper leaks an extra field caught by parseOutput (.strict) without exposing internal details', async () => {
      const res = await app.inject({ method: 'GET', url: '/test-errors/leak' });
      assert.equal(res.statusCode, 500);
      const body = apiErrorResponseSchema.parse(res.json());
      assert.equal(body.error.code, 'INTERNAL_ERROR');
      assert.equal(body.error.message, 'Internal server error');
      assert.equal(res.body.includes('internalSecretColumn'), false);
    });

    it('allows SPA origin and x-chaos-* headers on CORS preflight', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/test-errors/zod',
        headers: {
          origin: 'http://localhost:5199',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'x-chaos-delay, x-chaos-fail, x-chaos-status',
        },
      });
      assert.equal(res.statusCode, 204);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5199');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
      const allowedHeaders = String(res.headers['access-control-allow-headers'] ?? '').toLowerCase();
      assert.ok(allowedHeaders.includes('x-chaos-delay'));
      assert.ok(allowedHeaders.includes('x-chaos-fail'));
      assert.ok(allowedHeaders.includes('x-chaos-status'));
    });
  });
});
