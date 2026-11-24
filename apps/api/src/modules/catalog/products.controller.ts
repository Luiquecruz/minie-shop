import { Controller, Get, Inject, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  facetsDtoSchema,
  productDetailDtoSchema,
  productListResponseSchema,
  productSlugParamSchema,
} from '@minieshop/contracts';
import { sendWithPublicCache } from '../../common/http-cache.js';
import { parseOutput } from '../../common/parse-response.js';
import { parseCurrencyQueryParam } from './catalog-query.js';
import { CatalogService } from './catalog.service.js';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  async listProducts(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const rawQuery = (request.query ?? {}) as Record<string, unknown>;
    const result = await this.catalogService.listProducts(rawQuery);
    const payload = parseOutput(productListResponseSchema, result);
    await sendWithPublicCache(request, reply, payload);
  }

  @Get('facets')
  async getFacets(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const rawQuery = (request.query ?? {}) as Record<string, unknown>;
    const result = await this.catalogService.getFacets(rawQuery);
    const payload = parseOutput(facetsDtoSchema, result);
    await sendWithPublicCache(request, reply, payload);
  }

  @Get(':slug')
  async getProductBySlug(
    @Param('slug') rawSlug: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { slug } = productSlugParamSchema.parse({ slug: rawSlug });
    const rawQuery = (request.query ?? {}) as Record<string, unknown>;
    const currency = parseCurrencyQueryParam(rawQuery);
    const detail = await this.catalogService.getProductBySlug(slug, currency);
    const payload = parseOutput(productDetailDtoSchema, detail);
    await sendWithPublicCache(request, reply, payload);
  }
}
