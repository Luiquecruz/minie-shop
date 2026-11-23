import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { categoriesResponseSchema } from '@minieshop/contracts';
import { sendWithPublicCache } from '../../common/http-cache.js';
import { parseOutput } from '../../common/parse-response.js';
import { CatalogService } from './catalog.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  async listCategories(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const tree = await this.catalogService.getCategoryTree();
    const payload = parseOutput(categoriesResponseSchema, tree);
    await sendWithPublicCache(request, reply, payload);
  }
}
