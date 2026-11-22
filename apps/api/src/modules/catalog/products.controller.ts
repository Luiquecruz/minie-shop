import { Controller, Get, Inject, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  productDetailDtoSchema,
  productListResponseSchema,
  productSlugParamSchema,
} from '@minieshop/contracts';
import { sendWithPublicCache } from '../../common/http-cache.js';
import { parseOutput } from '../../common/parse-response.js';
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

  @Get(':slug')
  async getProductBySlug(
    @Param('slug') rawSlug: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { slug } = productSlugParamSchema.parse({ slug: rawSlug });
    const detail = await this.catalogService.getProductBySlug(slug);
    const payload = parseOutput(productDetailDtoSchema, detail);
    await sendWithPublicCache(request, reply, payload);
  }
}
