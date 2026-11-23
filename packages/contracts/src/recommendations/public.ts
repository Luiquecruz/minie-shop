import { z } from 'zod';
import { productCardDtoSchema } from '../catalog/public.js';

export const recommendationTypeSchema = z.enum(['related', 'upsell', 'cross_sell']);
export type RecommendationType = z.infer<typeof recommendationTypeSchema>;

/**
 * Keys on GET /products/:slug/recommendations match the exact `type` values,
 * including `cross_sell` (snake_case). Every requested type key is always present
 * (as an empty array when no eligible recommendations exist).
 */
export const productRecommendationsResponseSchema = z
  .object({
    related: z.array(productCardDtoSchema).optional(),
    upsell: z.array(productCardDtoSchema).optional(),
    cross_sell: z.array(productCardDtoSchema).optional(),
  })
  .strict();

export type ProductRecommendationsResponseDTO = z.infer<
  typeof productRecommendationsResponseSchema
>;

export const cartCrossSellResponseSchema = z
  .object({
    items: z.array(productCardDtoSchema),
  })
  .strict();

export type CartCrossSellResponseDTO = z.infer<typeof cartCrossSellResponseSchema>;
