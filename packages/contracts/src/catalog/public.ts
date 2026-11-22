import { z } from 'zod';

export const moneySchema = z
  .object({
    amount: z.number().int().nonnegative(),
    currency: z.string().min(3).max(3),
  })
  .strict();

export type MoneyDTO = z.infer<typeof moneySchema>;

export const imageVariantSchema = z
  .object({
    name: z.string().min(1),
    url: z.string().url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

export type ImageVariantDTO = z.infer<typeof imageVariantSchema>;

export const imageDtoSchema = z
  .object({
    id: z.string().uuid(),
    alt: z.string(),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
    placeholder: z.string(),
    variants: z.array(imageVariantSchema),
  })
  .strict();

export type ImageDTO = z.infer<typeof imageDtoSchema>;

export const attributeValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export type AttributeValue = z.infer<typeof attributeValueSchema>;

export const productAttributeDtoSchema = z
  .object({
    code: z.string().min(1),
    label: z.string().min(1),
    value: attributeValueSchema,
    unit: z.string().optional(),
    icon: z.string().optional(),
  })
  .strict();

export type ProductAttributeDTO = z.infer<typeof productAttributeDtoSchema>;

export const productCardDtoSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    price: moneySchema,
    inStock: z.boolean(),
    image: imageDtoSchema.nullable(),
    highlights: z.array(productAttributeDtoSchema),
    categorySlug: z.string().min(1),
  })
  .strict();

export type ProductCardDTO = z.infer<typeof productCardDtoSchema>;

export const categoryRefSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

export type CategoryRefDTO = z.infer<typeof categoryRefSchema>;

export const productDetailDtoSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    price: moneySchema,
    inStock: z.boolean(),
    category: categoryRefSchema,
    breadcrumbs: z.array(categoryRefSchema),
    images: z.array(imageDtoSchema),
    attributes: z.array(productAttributeDtoSchema),
  })
  .strict();

export type ProductDetailDTO = z.infer<typeof productDetailDtoSchema>;

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  children: CategoryDTO[];
}

export const categoryDtoSchema: z.ZodType<CategoryDTO> = z.lazy(() =>
  z
    .object({
      id: z.string().uuid(),
      slug: z.string().min(1),
      name: z.string().min(1),
      productCount: z.number().int().nonnegative(),
      children: z.array(categoryDtoSchema),
    })
    .strict(),
);

export const categoriesResponseSchema = z.array(categoryDtoSchema);

export type CategoriesResponseDTO = z.infer<typeof categoriesResponseSchema>;

export const productListResponseSchema = z
  .object({
    items: z.array(productCardDtoSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export type ProductListResponseDTO = z.infer<typeof productListResponseSchema>;

export const facetCategorySchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict();

export type FacetCategoryDTO = z.infer<typeof facetCategorySchema>;

export const facetOptionSchema = z
  .object({
    value: z.string(),
    label: z.string().optional(),
    count: z.number().int().nonnegative(),
  })
  .strict();

export type FacetOptionDTO = z.infer<typeof facetOptionSchema>;

export const facetRangeSchema = z
  .object({
    min: z.number(),
    max: z.number(),
  })
  .strict();

export type FacetRangeDTO = z.infer<typeof facetRangeSchema>;

export const facetAttributeTypeSchema = z.enum(['string', 'number', 'boolean', 'enum']);

export type FacetAttributeType = z.infer<typeof facetAttributeTypeSchema>;

export const facetAttributeSchema = z
  .object({
    code: z.string().min(1),
    label: z.string().min(1),
    type: facetAttributeTypeSchema,
    unit: z.string().optional(),
    options: z.array(facetOptionSchema).optional(),
    range: facetRangeSchema.optional(),
  })
  .strict();

export type FacetAttributeDTO = z.infer<typeof facetAttributeSchema>;

export const facetsDtoSchema = z
  .object({
    price: z
      .object({
        min: z.number().int().nonnegative().nullable(),
        max: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    categories: z.array(facetCategorySchema),
    attributes: z.array(facetAttributeSchema),
  })
  .strict();

export type FacetsDTO = z.infer<typeof facetsDtoSchema>;

export const favoriteCreatedResponseSchema = z
  .object({
    favorited: z.literal(true),
  })
  .strict();

export type FavoriteCreatedResponseDTO = z.infer<typeof favoriteCreatedResponseSchema>;

export const favoritesListResponseSchema = z
  .object({
    productIds: z.array(z.string().uuid()),
  })
  .strict();

export type FavoritesListResponseDTO = z.infer<typeof favoritesListResponseSchema>;

export const productSortSchema = z.enum([
  'newest',
  'price_asc',
  'price_desc',
  'name_asc',
  'relevance',
]);

export type ProductSort = z.infer<typeof productSortSchema>;

export const productSlugParamSchema = z
  .object({
    slug: z
      .string()
      .min(1, 'Product slug is required')
      .refine((value) => value !== 'facets', {
        message: 'Slug "facets" is reserved',
      }),
  })
  .strict();

export type ProductSlugParam = z.infer<typeof productSlugParamSchema>;

export const productIdParamSchema = z
  .object({
    productId: z.string().uuid('productId must be a valid UUID'),
  })
  .strict();

export type ProductIdParam = z.infer<typeof productIdParamSchema>;
