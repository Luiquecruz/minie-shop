import { productSortSchema, type ProductSort } from '@minieshop/contracts';
import { z } from 'zod';
import type {
  CatalogFilterParams,
  NumericAttributeRangeFilter,
} from '../domain/repositories/ProductRepository';

export interface CatalogUrlState extends CatalogFilterParams {
  sort: ProductSort;
}

const nonNegativeIntStringSchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform((val) => Number(val))
  .refine((num) => Number.isSafeInteger(num) && num >= 0);

const finiteNumberStringSchema = z
  .string()
  .trim()
  .min(1)
  .transform((val) => Number(val))
  .refine((num) => Number.isFinite(num));

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/i);

/**
 * Parses and validates URLSearchParams with Zod using exact API parameter names.
 * Any invalid parameter falls back cleanly to its default without throwing.
 */
export function parseCatalogUrlParams(
  searchParams: URLSearchParams,
): CatalogUrlState {
  const rawCategory = searchParams.get('category');
  const parsedCategory = rawCategory ? slugSchema.safeParse(rawCategory) : null;
  const category =
    parsedCategory && parsedCategory.success ? parsedCategory.data : undefined;

  const rawQ = searchParams.get('q')?.trim();
  const q = rawQ && rawQ.length > 0 ? rawQ : undefined;

  const rawMinPrice = searchParams.get('minPrice');
  const parsedMinPrice = rawMinPrice
    ? nonNegativeIntStringSchema.safeParse(rawMinPrice)
    : null;
  let minPrice =
    parsedMinPrice && parsedMinPrice.success ? parsedMinPrice.data : undefined;

  const rawMaxPrice = searchParams.get('maxPrice');
  const parsedMaxPrice = rawMaxPrice
    ? nonNegativeIntStringSchema.safeParse(rawMaxPrice)
    : null;
  let maxPrice =
    parsedMaxPrice && parsedMaxPrice.success ? parsedMaxPrice.data : undefined;

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    minPrice = undefined;
    maxPrice = undefined;
  }

  const rawInStock = searchParams.get('inStock');
  const inStock =
    rawInStock === 'true' ? true : rawInStock === 'false' ? false : undefined;

  const rawSort = searchParams.get('sort');
  const parsedSort = rawSort ? productSortSchema.safeParse(rawSort) : null;
  let sort: ProductSort =
    parsedSort && parsedSort.success ? parsedSort.data : 'newest';
  if (sort === 'relevance' && !q) {
    sort = 'newest';
  }

  const attributes: Record<string, string[]> = {};
  const numericAttributes: Record<string, NumericAttributeRangeFilter> = {};

  for (const [key, rawValue] of searchParams.entries()) {
    if (!key.startsWith('attr.')) continue;
    const rest = key.slice('attr.'.length);

    const rangeMatch = /^([a-z0-9_]+)\.(min|max)$/.exec(rest);
    if (rangeMatch) {
      const code = rangeMatch[1];
      const bound = rangeMatch[2] as 'min' | 'max';
      const parsedNum = finiteNumberStringSchema.safeParse(rawValue);
      if (parsedNum.success) {
        numericAttributes[code] = {
          ...numericAttributes[code],
          [bound]: parsedNum.data,
        };
      }
      continue;
    }

    if (/^[a-z0-9_]+$/.test(rest)) {
      const values = Array.from(
        new Set(
          rawValue
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v.length > 0),
        ),
      );
      if (values.length > 0) {
        attributes[rest] = values;
      }
    }
  }

  // Drop invalid numeric ranges where min > max
  for (const [code, range] of Object.entries(numericAttributes)) {
    if (
      range.min !== undefined &&
      range.max !== undefined &&
      range.min > range.max
    ) {
      delete numericAttributes[code];
    }
  }

  return {
    category,
    q,
    minPrice,
    maxPrice,
    inStock,
    sort,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    numericAttributes:
      Object.keys(numericAttributes).length > 0 ? numericAttributes : undefined,
  };
}

/**
 * Serializes CatalogUrlState into canonical URLSearchParams matching API names.
 */
export function serializeCatalogUrlParams(
  state: CatalogUrlState,
): URLSearchParams {
  const params = new URLSearchParams();

  if (state.category) {
    params.set('category', state.category);
  }
  if (state.q && state.q.trim().length > 0) {
    params.set('q', state.q.trim());
  }
  if (state.minPrice !== undefined) {
    params.set('minPrice', String(Math.trunc(state.minPrice)));
  }
  if (state.maxPrice !== undefined) {
    params.set('maxPrice', String(Math.trunc(state.maxPrice)));
  }
  if (state.inStock !== undefined) {
    params.set('inStock', String(state.inStock));
  }
  if (
    state.sort &&
    state.sort !== 'newest' &&
    (state.sort !== 'relevance' || Boolean(state.q?.trim()))
  ) {
    params.set('sort', state.sort);
  }

  if (state.attributes) {
    for (const code of Object.keys(state.attributes).sort()) {
      const values = Array.from(
        new Set(
          state.attributes[code]
            .map((v) => v.trim())
            .filter((v) => v.length > 0),
        ),
      );
      if (values.length > 0) {
        params.set(`attr.${code}`, values.join(','));
      }
    }
  }

  if (state.numericAttributes) {
    for (const code of Object.keys(state.numericAttributes).sort()) {
      const range = state.numericAttributes[code];
      if (range.min !== undefined && Number.isFinite(range.min)) {
        params.set(`attr.${code}.min`, String(range.min));
      }
      if (range.max !== undefined && Number.isFinite(range.max)) {
        params.set(`attr.${code}.max`, String(range.max));
      }
    }
  }

  return params;
}

export function hasActiveCatalogFilters(state: CatalogUrlState): boolean {
  return Boolean(
    state.category ||
      state.q ||
      state.minPrice !== undefined ||
      state.maxPrice !== undefined ||
      state.inStock !== undefined ||
      (state.attributes && Object.keys(state.attributes).length > 0) ||
      (state.numericAttributes &&
        Object.keys(state.numericAttributes).length > 0),
  );
}
