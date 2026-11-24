import { z } from 'zod';

export const SUPPORTED_CURRENCY_CODES = ['BRL', 'USD', 'EUR'] as const;

export const supportedCurrencySchema = z.enum(SUPPORTED_CURRENCY_CODES);

export type SupportedCurrency = z.infer<typeof supportedCurrencySchema>;

export const moneySchema = z
  .object({
    amount: z.number().int().nonnegative(),
    currency: supportedCurrencySchema,
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

export const shippingMethodCodeSchema = z.enum(['standard', 'express', 'pickup']);

export type ShippingMethodCode = z.infer<typeof shippingMethodCodeSchema>;

export const pricingQuoteRequestSchema = z
  .object({
    currency: supportedCurrencySchema.default('BRL'),
    productIds: z.array(z.string().uuid('Each productId must be a valid UUID')).max(100),
  })
  .strict();

export type PricingQuoteRequestDTO = z.infer<typeof pricingQuoteRequestSchema>;

export const quotedProductPriceSchema = z
  .object({
    productId: z.string().uuid(),
    price: moneySchema,
    inStock: z.boolean(),
  })
  .strict();

export type QuotedProductPriceDTO = z.infer<typeof quotedProductPriceSchema>;

export const quotedShippingOptionSchema = z
  .object({
    id: shippingMethodCodeSchema,
    basePriceCents: z.number().int().nonnegative(),
  })
  .strict();

export type QuotedShippingOptionDTO = z.infer<typeof quotedShippingOptionSchema>;

export const pricingQuoteResponseSchema = z
  .object({
    currency: supportedCurrencySchema,
    items: z.array(quotedProductPriceSchema),
    freeShippingThresholdCents: z.number().int().nonnegative(),
    shippingOptions: z.array(quotedShippingOptionSchema).min(1),
  })
  .strict();

export type PricingQuoteResponseDTO = z.infer<typeof pricingQuoteResponseSchema>;
