import { z } from 'zod';
import { errorCodeSchema } from '../errors.js';
import {
  attributeValueSchema,
  facetAttributeTypeSchema,
  type CategoriesResponseDTO,
  type CategoryDTO,
  type CategoryRefDTO,
  type FacetAttributeDTO,
  type FacetCategoryDTO,
  type FacetOptionDTO,
  type FacetRangeDTO,
  type FacetsDTO,
  type FavoriteCreatedResponseDTO,
  type FavoritesListResponseDTO,
  type ImageDTO,
  type ImageVariantDTO,
  type MoneyDTO,
  type ProductAttributeDTO,
  type ProductCardDTO,
  type ProductDetailDTO,
  type ProductListResponseDTO,
} from './public.js';
import type { ApiErrorResponse, ErrorDetail } from '../errors.js';

/**
 * Tolerant client-side schemas (.strip()) sharing the exact DTO types from
 * server-side .strict() contracts so additive API fields never break the UI.
 */

export const clientMoneySchema: z.ZodType<MoneyDTO> = z
  .object({
    amount: z.number().int().nonnegative(),
    currency: z.string().min(3).max(3),
  })
  .strip();

export const clientImageVariantSchema: z.ZodType<ImageVariantDTO> = z
  .object({
    name: z.string().min(1),
    url: z.string().url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strip();

export const clientImageDtoSchema: z.ZodType<ImageDTO> = z
  .object({
    id: z.string().uuid(),
    alt: z.string(),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
    placeholder: z.string(),
    variants: z.array(clientImageVariantSchema),
  })
  .strip();

export const clientProductAttributeDtoSchema: z.ZodType<ProductAttributeDTO> = z
  .object({
    code: z.string().min(1),
    label: z.string().min(1),
    value: attributeValueSchema,
    unit: z.string().optional(),
    icon: z.string().optional(),
  })
  .strip();

export const clientProductCardDtoSchema: z.ZodType<ProductCardDTO> = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    price: clientMoneySchema,
    inStock: z.boolean(),
    image: clientImageDtoSchema.nullable(),
    highlights: z.array(clientProductAttributeDtoSchema),
    categorySlug: z.string().min(1),
  })
  .strip();

export const clientCategoryRefSchema: z.ZodType<CategoryRefDTO> = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
  })
  .strip();

export const clientProductDetailDtoSchema: z.ZodType<ProductDetailDTO> = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    price: clientMoneySchema,
    inStock: z.boolean(),
    category: clientCategoryRefSchema,
    breadcrumbs: z.array(clientCategoryRefSchema),
    images: z.array(clientImageDtoSchema),
    attributes: z.array(clientProductAttributeDtoSchema),
  })
  .strip();

export const clientCategoryDtoSchema: z.ZodType<CategoryDTO> = z.lazy(() =>
  z
    .object({
      id: z.string().uuid(),
      slug: z.string().min(1),
      name: z.string().min(1),
      productCount: z.number().int().nonnegative(),
      children: z.array(clientCategoryDtoSchema),
    })
    .strip(),
);

export const clientCategoriesResponseSchema: z.ZodType<CategoriesResponseDTO> = z.array(
  clientCategoryDtoSchema,
);

export const clientProductListResponseSchema: z.ZodType<ProductListResponseDTO> = z
  .object({
    items: z.array(clientProductCardDtoSchema),
    nextCursor: z.string().nullable(),
  })
  .strip();

export const clientFacetCategorySchema: z.ZodType<FacetCategoryDTO> = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .strip();

export const clientFacetOptionSchema: z.ZodType<FacetOptionDTO> = z
  .object({
    value: z.string(),
    label: z.string().optional(),
    count: z.number().int().nonnegative(),
  })
  .strip();

export const clientFacetRangeSchema: z.ZodType<FacetRangeDTO> = z
  .object({
    min: z.number(),
    max: z.number(),
  })
  .strip();

export const clientFacetAttributeSchema: z.ZodType<FacetAttributeDTO> = z
  .object({
    code: z.string().min(1),
    label: z.string().min(1),
    type: facetAttributeTypeSchema,
    unit: z.string().optional(),
    options: z.array(clientFacetOptionSchema).optional(),
    range: clientFacetRangeSchema.optional(),
  })
  .strip();

export const clientFacetsDtoSchema: z.ZodType<FacetsDTO> = z
  .object({
    price: z
      .object({
        min: z.number().int().nonnegative().nullable(),
        max: z.number().int().nonnegative().nullable(),
      })
      .strip(),
    categories: z.array(clientFacetCategorySchema),
    attributes: z.array(clientFacetAttributeSchema),
  })
  .strip();

export const clientFavoriteCreatedResponseSchema: z.ZodType<FavoriteCreatedResponseDTO> = z
  .object({
    favorited: z.literal(true),
  })
  .strip();

export const clientFavoritesListResponseSchema: z.ZodType<FavoritesListResponseDTO> = z
  .object({
    productIds: z.array(z.string().uuid()),
  })
  .strip();

export const clientErrorDetailSchema: z.ZodType<ErrorDetail> = z
  .object({
    path: z.string(),
    message: z.string(),
  })
  .strip();

export const clientApiErrorResponseSchema: z.ZodType<ApiErrorResponse> = z
  .object({
    error: z
      .object({
        code: errorCodeSchema,
        message: z.string(),
        details: z.array(clientErrorDetailSchema).optional(),
        requestId: z.string(),
      })
      .strip(),
  })
  .strip();
