import { z } from 'zod';
import { productCardDtoSchema } from '../catalog/public.js';

export const searchIndexDocumentSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    brand: z.string().optional(),
    categoryPath: z.array(z.string().min(1)),
    categoryNames: z.string(),
    attributesText: z.string(),
    price: z.number().int().nonnegative(),
    inStock: z.boolean(),
    createdAt: z.number().int().nonnegative(),
  })
  .strict();

export type SearchIndexDocument = z.infer<typeof searchIndexDocumentSchema>;

export const searchModeSchema = z.enum(['hybrid', 'keyword', 'postgres']);

export type SearchMode = z.infer<typeof searchModeSchema>;

export const searchRequestedModeSchema = z.enum(['hybrid', 'keyword']);

export type SearchRequestedMode = z.infer<typeof searchRequestedModeSchema>;

export const searchResponseSchema = z
  .object({
    items: z.array(productCardDtoSchema),
    estimatedTotal: z.number().int().nonnegative(),
    mode: searchModeSchema,
  })
  .strict();

export type SearchResponseDTO = z.infer<typeof searchResponseSchema>;

export const searchSuggestionSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
    categoryName: z.string(),
  })
  .strict();

export type SearchSuggestionDTO = z.infer<typeof searchSuggestionSchema>;

export const searchSuggestResponseSchema = z
  .object({
    suggestions: z.array(searchSuggestionSchema),
    mode: searchModeSchema,
  })
  .strict();

export type SearchSuggestResponseDTO = z.infer<typeof searchSuggestResponseSchema>;
