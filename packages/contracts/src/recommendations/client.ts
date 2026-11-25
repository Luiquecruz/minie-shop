import { z } from 'zod';
import { clientProductCardDtoSchema } from '../catalog/client.js';
import type { CartCrossSellResponseDTO, ProductRecommendationsResponseDTO } from './public.js';

/**
 * Tolerant client-side recommendation schemas (.strip()) sharing exact DTO types
 * from server-side .strict() contracts so additive API fields never break the UI.
 */

export const clientProductRecommendationsResponseSchema: z.ZodType<ProductRecommendationsResponseDTO> =
  z
    .object({
      related: z.array(clientProductCardDtoSchema).optional(),
      upsell: z.array(clientProductCardDtoSchema).optional(),
      cross_sell: z.array(clientProductCardDtoSchema).optional(),
    })
    .strip();

export const clientCartCrossSellResponseSchema: z.ZodType<CartCrossSellResponseDTO> = z
  .object({
    items: z.array(clientProductCardDtoSchema),
  })
  .strip();
