import { Controller, Get, Inject, Param, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  cartCrossSellResponseSchema,
  productRecommendationsResponseSchema,
  productSlugParamSchema,
  recommendationTypeSchema,
  supportedCurrencySchema,
  type ProductCardDTO,
  type ProductRecommendationsResponseDTO,
  type RecommendationType,
} from '@minieshop/contracts';
import { z } from 'zod';
import { notFoundError } from '../../common/errors.js';
import { sendWithPublicCache } from '../../common/http-cache.js';
import { parseOutput } from '../../common/parse-response.js';
import { CatalogService } from '../catalog/index.js';
import { RelationsService } from './relations.service.js';

const ALL_TYPES: readonly RecommendationType[] = ['related', 'upsell', 'cross_sell'];

const DEFAULT_LIMITS: Record<RecommendationType, number> = {
  related: 8,
  upsell: 4,
  cross_sell: 6,
};

const MAX_LIMIT = 12;
const MAX_CART_PRODUCT_IDS = 20;

const nonNegIntString = z
  .string()
  .regex(/^\d+$/, 'Must be a non-negative integer')
  .transform((v) => Number(v));

const booleanFlagSchema = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const uuidSchema = z.string().uuid('Each productId must be a valid UUID');

const currencyQuerySchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  supportedCurrencySchema,
);

const productRecommendationsQuerySchema = z
  .object({
    types: z
      .string()
      .trim()
      .min(1, 'types must not be empty')
      .transform((raw, ctx) => {
        const parts = raw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (parts.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'types must contain at least one valid recommendation type',
          });
          return z.NEVER;
        }
        const validated: RecommendationType[] = [];
        for (const part of parts) {
          const parsed = recommendationTypeSchema.safeParse(part);
          if (!parsed.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid recommendation type "${part}". Allowed: related, upsell, cross_sell`,
            });
            return z.NEVER;
          }
          if (!validated.includes(parsed.data)) {
            validated.push(parsed.data);
          }
        }
        return validated;
      })
      .optional(),
    limit: nonNegIntString
      .refine((v) => v >= 1 && v <= MAX_LIMIT, {
        message: `limit must be between 1 and ${MAX_LIMIT}`,
      })
      .optional(),
    includeOutOfStock: booleanFlagSchema.optional(),
    currency: currencyQuerySchema.optional(),
  })
  .strict();

const cartCrossSellQuerySchema = z
  .object({
    productIds: z
      .string()
      .trim()
      .min(1, 'Query parameter "productIds" is required')
      .transform((raw, ctx) => {
        const parts = raw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (parts.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'productIds must contain at least one UUID',
          });
          return z.NEVER;
        }
        if (parts.length > MAX_CART_PRODUCT_IDS) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `productIds accepts at most ${MAX_CART_PRODUCT_IDS} IDs`,
          });
          return z.NEVER;
        }
        const unique: string[] = [];
        for (const id of parts) {
          const parsed = uuidSchema.safeParse(id);
          if (!parsed.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid UUID "${id}" in productIds`,
            });
            return z.NEVER;
          }
          if (!unique.includes(parsed.data)) {
            unique.push(parsed.data);
          }
        }
        return unique;
      }),
    limit: nonNegIntString
      .refine((v) => v >= 1 && v <= MAX_LIMIT, {
        message: `limit must be between 1 and ${MAX_LIMIT}`,
      })
      .optional(),
    includeOutOfStock: booleanFlagSchema.optional(),
    currency: currencyQuerySchema.optional(),
  })
  .strict();

@Controller()
export class RecommendationsController {
  constructor(
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
    @Inject(RelationsService)
    private readonly relationsService: RelationsService,
  ) {}

  @Get('products/:slug/recommendations')
  async getProductRecommendations(
    @Param('slug') rawSlug: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { slug } = productSlugParamSchema.parse({ slug: rawSlug });
    const query = productRecommendationsQuerySchema.parse(request.query ?? {});

    const productId = await this.catalogService.getPublishedProductIdBySlug(slug);
    if (!productId) {
      throw notFoundError(`Product "${slug}" not found`);
    }

    const requestedTypes: RecommendationType[] = query.types ?? [...ALL_TYPES];
    const includeOutOfStock = query.includeOutOfStock ?? false;

    const maxRequestedLimit = Math.max(
      ...requestedTypes.map((t) => query.limit ?? DEFAULT_LIMITS[t]),
    );
    const overfetchLimit = Math.max(maxRequestedLimit * 3, 24);

    const idsByType = await this.relationsService.getOrderedRelatedProductIds({
      productId,
      types: requestedTypes,
      overfetchLimit,
    });

    // Hydrate all candidate IDs in a single batched call to CatalogService (published only, fresh stock/price)
    const allCandidateIds = Array.from(
      new Set(requestedTypes.flatMap((t) => idsByType[t])),
    );
    const hydratedCards = await this.catalogService.getProductCardsByIdsOrdered(
      allCandidateIds,
      query.currency ?? 'BRL',
    );
    const cardById = new Map<string, ProductCardDTO>(hydratedCards.map((c) => [c.id, c]));

    const response: ProductRecommendationsResponseDTO = {};

    for (const type of requestedTypes) {
      const limit = query.limit ?? DEFAULT_LIMITS[type];
      const cards: ProductCardDTO[] = [];

      for (const candidateId of idsByType[type]) {
        if (cards.length >= limit) {
          break;
        }
        const card = cardById.get(candidateId);
        if (!card) {
          continue;
        }
        if (!includeOutOfStock && !card.inStock) {
          continue;
        }
        cards.push(card);
      }

      response[type] = cards;
    }

    const payload = parseOutput(productRecommendationsResponseSchema, response);
    await sendWithPublicCache(request, reply, payload);
  }

  @Get('recommendations/cross-sell')
  async getCartCrossSell(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const query = cartCrossSellQuerySchema.parse(request.query ?? {});
    const limit = query.limit ?? DEFAULT_LIMITS.cross_sell;
    const includeOutOfStock = query.includeOutOfStock ?? false;
    const overfetchLimit = Math.max(limit * 3, 24);

    const candidateIds = await this.relationsService.getAggregatedCrossSellIds({
      productIds: query.productIds,
      overfetchLimit,
    });

    const hydratedCards = await this.catalogService.getProductCardsByIdsOrdered(
      candidateIds,
      query.currency ?? 'BRL',
    );
    const filtered = includeOutOfStock
      ? hydratedCards
      : hydratedCards.filter((card) => card.inStock);

    const payload = parseOutput(cartCrossSellResponseSchema, {
      items: filtered.slice(0, limit),
    });
    await sendWithPublicCache(request, reply, payload);
  }
}
