import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  searchRequestedModeSchema,
  searchResponseSchema,
  searchSuggestResponseSchema,
} from '@minieshop/contracts';
import { z } from 'zod';
import { sendWithPublicCache } from '../../common/http-cache.js';
import { parseOutput } from '../../common/parse-response.js';
import { SearchService } from './search.service.js';

const nonNegIntString = z
  .string()
  .regex(/^\d+$/, 'Must be a non-negative integer')
  .transform((v) => Number(v));

const searchQuerySchema = z
  .object({
    q: z.string().trim().min(1, 'Query parameter "q" is required'),
    limit: nonNegIntString
      .refine((v) => v >= 1 && v <= 60, { message: 'limit must be between 1 and 60' })
      .optional(),
    offset: nonNegIntString
      .refine((v) => v >= 0 && v <= 200, { message: 'offset must be between 0 and 200' })
      .optional(),
    category: z.string().trim().min(1).optional(),
    minPrice: nonNegIntString.optional(),
    maxPrice: nonNegIntString.optional(),
    inStock: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    mode: searchRequestedModeSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.minPrice !== undefined &&
      data.maxPrice !== undefined &&
      data.minPrice > data.maxPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minPrice'],
        message: 'minPrice must be less than or equal to maxPrice',
      });
    }
  });

const suggestQuerySchema = z
  .object({
    q: z.string().trim().min(1, 'Query parameter "q" is required'),
    limit: nonNegIntString
      .refine((v) => v >= 1 && v <= 8, { message: 'limit must be between 1 and 8' })
      .optional(),
  })
  .strict();

@Controller('search')
export class SearchController {
  constructor(
    @Inject(SearchService)
    private readonly searchService: SearchService,
  ) {}

  @Get()
  async search(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const parsed = searchQuerySchema.parse(request.query ?? {});
    const requestId = typeof request.id === 'string' ? request.id : String(request.id ?? 'unknown');

    const result = await this.searchService.search(
      {
        q: parsed.q,
        limit: parsed.limit ?? 12,
        offset: parsed.offset ?? 0,
        category: parsed.category,
        minPrice: parsed.minPrice,
        maxPrice: parsed.maxPrice,
        inStock: parsed.inStock,
        mode: parsed.mode ?? 'hybrid',
      },
      { requestId, logger: request.log },
    );

    const payload = parseOutput(searchResponseSchema, result);
    await sendWithPublicCache(request, reply, payload);
  }

  @Get('suggest')
  async suggest(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const parsed = suggestQuerySchema.parse(request.query ?? {});
    const requestId = typeof request.id === 'string' ? request.id : String(request.id ?? 'unknown');

    const result = await this.searchService.suggest(parsed.q, parsed.limit ?? 8, {
      requestId,
      logger: request.log,
    });

    const payload = parseOutput(searchSuggestResponseSchema, result);
    await sendWithPublicCache(request, reply, payload);
  }
}
