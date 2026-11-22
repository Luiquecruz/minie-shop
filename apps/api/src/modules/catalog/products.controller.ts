import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { productListResponseSchema } from '@minieshop/contracts';
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
}
