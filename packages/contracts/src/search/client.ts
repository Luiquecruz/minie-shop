import { z } from 'zod';
import { clientProductCardDtoSchema } from '../catalog/client.js';
import {
  searchModeSchema,
  type SearchResponseDTO,
  type SearchSuggestResponseDTO,
  type SearchSuggestionDTO,
} from './public.js';

/**
 * Tolerant client-side search schemas (.strip()) sharing exact DTO types from
 * server-side .strict() contracts so additive API fields never break the UI.
 */

export const clientSearchResponseSchema: z.ZodType<SearchResponseDTO> = z
  .object({
    items: z.array(clientProductCardDtoSchema),
    estimatedTotal: z.number().int().nonnegative(),
    mode: searchModeSchema,
  })
  .strip();

export const clientSearchSuggestionSchema: z.ZodType<SearchSuggestionDTO> = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
    categoryName: z.string(),
    categorySlug: z.string(),
  })
  .strip();

export const clientSearchSuggestResponseSchema: z.ZodType<SearchSuggestResponseDTO> = z
  .object({
    suggestions: z.array(clientSearchSuggestionSchema),
    mode: searchModeSchema,
  })
  .strip();
