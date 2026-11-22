import { randomUUID } from 'node:crypto';
import { Controller, Delete, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  favoriteCreatedResponseSchema,
  favoritesListResponseSchema,
  productIdParamSchema,
} from '@minieshop/contracts';
import { applyNoStoreCache } from '../../common/http-cache.js';
import { parseOutput } from '../../common/parse-response.js';
import { loadEnv } from '../../config/env.js';
import { CatalogService } from './catalog.service.js';

export const ANON_COOKIE_NAME = 'anon_id';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('favorites')
export class FavoritesController {
  constructor(
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
  ) {}

  private resolveOrCreateSessionId(request: FastifyRequest, reply: FastifyReply): string {
    const rawCookie = request.cookies?.[ANON_COOKIE_NAME];
    if (typeof rawCookie === 'string' && rawCookie.length > 0) {
      const unsigned = request.unsignCookie(rawCookie);
      if (unsigned.valid && typeof unsigned.value === 'string' && UUID_REGEX.test(unsigned.value)) {
        return unsigned.value;
      }
    }

    const newSessionId = randomUUID();
    const env = loadEnv();
    void reply.setCookie(ANON_COOKIE_NAME, newSessionId, {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
    });
    return newSessionId;
  }

  @Get()
  async listFavorites(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    applyNoStoreCache(reply);
    const sessionId = this.resolveOrCreateSessionId(request, reply);
    const productIds = await this.catalogService.listFavoritesBySession(sessionId);
    const payload = parseOutput(favoritesListResponseSchema, { productIds });
    await reply.code(200).send(payload);
  }

  @Post(':productId')
  async addFavorite(
    @Param('productId') rawProductId: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    applyNoStoreCache(reply);
    const { productId } = productIdParamSchema.parse({ productId: rawProductId });
    const sessionId = this.resolveOrCreateSessionId(request, reply);
    await this.catalogService.addFavoriteForSession(sessionId, productId);
    const payload = parseOutput(favoriteCreatedResponseSchema, { favorited: true });
    await reply.code(200).send(payload);
  }

  @Delete(':productId')
  async removeFavorite(
    @Param('productId') rawProductId: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    applyNoStoreCache(reply);
    const { productId } = productIdParamSchema.parse({ productId: rawProductId });
    const sessionId = this.resolveOrCreateSessionId(request, reply);
    await this.catalogService.removeFavoriteForSession(sessionId, productId);
    await reply.code(204).send();
  }
}
