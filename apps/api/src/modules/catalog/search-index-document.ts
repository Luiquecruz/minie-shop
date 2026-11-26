import { z } from 'zod';

/**
 * Internal backend contract shared between `catalog` (producer) and `search` (consumer)
 * for Meilisearch indexing and embedding text generation. Kept out of `@minieshop/contracts`
 * so storefront/external consumers never depend on search-index internals.
 */
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
