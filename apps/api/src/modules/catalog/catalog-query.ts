import {
  productSortSchema,
  supportedCurrencySchema,
  type ErrorDetail,
  type ProductSort,
  type SupportedCurrency,
} from '@minieshop/contracts';
import { z } from 'zod';
import { validationError } from '../../common/errors.js';

export interface AttributeDefinitionInfo {
  code: string;
  label: string;
  dataType: 'string' | 'number' | 'boolean' | 'enum';
  unit: string | null;
  isFilterable: boolean;
  showOnCard: boolean;
  iconKey: string | null;
  sortOrder: number;
}

export interface DiscreteAttributeFilter {
  code: string;
  dataType: 'string' | 'enum' | 'boolean';
  values: string[];
}

export interface NumericAttributeFilter {
  code: string;
  min?: number;
  max?: number;
}

export interface ParsedCatalogFilters {
  currency: SupportedCurrency;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  q?: string;
  discreteAttributes: DiscreteAttributeFilter[];
  numericAttributes: NumericAttributeFilter[];
}

export interface ParsedProductListQuery extends ParsedCatalogFilters {
  sort: ProductSort;
  limit: number;
  cursor?: DecodedCursor;
}

export interface DecodedCursor {
  s: ProductSort;
  k: string | number;
  id: string;
  cur?: SupportedCurrency;
}

const cursorPayloadSchema = z
  .object({
    s: productSortSchema,
    k: z.union([z.string(), z.number()]),
    id: z.string().uuid(),
    cur: supportedCurrencySchema.optional(),
  })
  .strict();

export function encodeCursor(payload: DecodedCursor): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(
  raw: string,
  expectedSort: ProductSort,
  expectedCurrency: SupportedCurrency = 'BRL',
): DecodedCursor {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = cursorPayloadSchema.parse(JSON.parse(json));
    if (parsed.s !== expectedSort) {
      throw new Error('Cursor sort mismatch');
    }
    const cursorCurrency: SupportedCurrency = parsed.cur ?? 'BRL';
    if (cursorCurrency !== expectedCurrency) {
      throw new Error('Cursor currency mismatch');
    }
    return parsed;
  } catch {
    throw validationError([{ path: 'cursor', message: 'Invalid or mismatched pagination cursor' }]);
  }
}

const KNOWN_LIST_KEYS = new Set([
  'currency',
  'category',
  'minPrice',
  'maxPrice',
  'inStock',
  'q',
  'sort',
  'limit',
  'cursor',
]);

const KNOWN_FACETS_KEYS = new Set(['currency', 'category', 'minPrice', 'maxPrice', 'inStock', 'q']);

function getSingleStringParam(
  rawQuery: Record<string, unknown>,
  key: string,
  details: ErrorDetail[],
): string | undefined {
  const val = rawQuery[key];
  if (val === undefined) {
    return undefined;
  }
  if (Array.isArray(val)) {
    details.push({ path: key, message: `Duplicate query parameter "${key}" is not allowed` });
    return undefined;
  }
  if (typeof val !== 'string') {
    details.push({ path: key, message: `Query parameter "${key}" must be a string` });
    return undefined;
  }
  return val;
}

function parseNonNegativeInt(
  raw: string | undefined,
  key: string,
  details: ErrorDetail[],
): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(raw.trim())) {
    details.push({ path: key, message: `${key} must be a non-negative integer (cents)` });
    return undefined;
  }
  const num = Number(raw.trim());
  if (!Number.isSafeInteger(num) || num < 0) {
    details.push({ path: key, message: `${key} must be a valid non-negative integer` });
    return undefined;
  }
  return num;
}

function parseFiniteNumber(
  raw: string,
  key: string,
  details: ErrorDetail[],
): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    details.push({ path: key, message: `${key} must be a valid number` });
    return undefined;
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    details.push({ path: key, message: `${key} must be a finite number` });
    return undefined;
  }
  return num;
}

export function parseCurrencyQueryParam(rawQuery: Record<string, unknown>): SupportedCurrency {
  const details: ErrorDetail[] = [];
  for (const key of Object.keys(rawQuery)) {
    if (key !== 'currency') {
      details.push({ path: key, message: `Unknown query parameter "${key}"` });
    }
  }
  const currencyRaw = getSingleStringParam(rawQuery, 'currency', details);
  let currency: SupportedCurrency = 'BRL';
  if (currencyRaw !== undefined) {
    const parsed = supportedCurrencySchema.safeParse(currencyRaw.trim().toUpperCase());
    if (!parsed.success) {
      details.push({ path: 'currency', message: 'currency must be one of: BRL, USD, EUR' });
    } else {
      currency = parsed.data;
    }
  }
  if (details.length > 0) {
    throw validationError(details);
  }
  return currency;
}

export function parseCatalogFilters(
  rawQuery: Record<string, unknown>,
  attributeDefs: AttributeDefinitionInfo[],
  mode: 'list' | 'facets',
): ParsedCatalogFilters {
  const details: ErrorDetail[] = [];
  const allowedKeys = mode === 'list' ? KNOWN_LIST_KEYS : KNOWN_FACETS_KEYS;
  const defsByCode = new Map(attributeDefs.map((def) => [def.code, def]));

  const discreteMap = new Map<string, DiscreteAttributeFilter>();
  const numericMap = new Map<string, NumericAttributeFilter>();

  for (const key of Object.keys(rawQuery)) {
    if (allowedKeys.has(key)) {
      continue;
    }

    if (key.startsWith('attr.')) {
      const rest = key.slice('attr.'.length);
      const rawVal = getSingleStringParam(rawQuery, key, details);
      if (rawVal === undefined) {
        continue;
      }

      const rangeMatch = /^([a-z0-9_]+)\.(min|max)$/.exec(rest);
      if (rangeMatch) {
        const code = rangeMatch[1]!;
        const bound = rangeMatch[2] as 'min' | 'max';
        const def = defsByCode.get(code);
        if (!def || !def.isFilterable) {
          details.push({
            path: key,
            message: `Attribute "${code}" is unknown or not filterable`,
          });
          continue;
        }
        if (def.dataType !== 'number') {
          details.push({
            path: key,
            message: `Range filter "${key}" is only allowed for numeric attributes`,
          });
          continue;
        }
        const num = parseFiniteNumber(rawVal, key, details);
        if (num !== undefined) {
          const entry = numericMap.get(code) ?? { code };
          entry[bound] = num;
          numericMap.set(code, entry);
        }
        continue;
      }

      if (/^[a-z0-9_]+$/.test(rest)) {
        const code = rest;
        const def = defsByCode.get(code);
        if (!def || !def.isFilterable) {
          details.push({
            path: key,
            message: `Attribute "${code}" is unknown or not filterable`,
          });
          continue;
        }
        if (def.dataType === 'number') {
          details.push({
            path: key,
            message: `Numeric attribute "${code}" requires attr.${code}.min and/or attr.${code}.max`,
          });
          continue;
        }

        const values = rawVal
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0);

        if (values.length === 0) {
          details.push({ path: key, message: `Filter "${key}" must provide at least one value` });
          continue;
        }

        if (def.dataType === 'boolean') {
          const invalidBool = values.find((v) => v !== 'true' && v !== 'false');
          if (invalidBool !== undefined) {
            details.push({
              path: key,
              message: `Boolean attribute "${code}" only accepts "true" or "false"`,
            });
            continue;
          }
        }

        discreteMap.set(code, {
          code,
          dataType: def.dataType,
          values: Array.from(new Set(values)),
        });
        continue;
      }

      details.push({ path: key, message: `Invalid attribute filter syntax "${key}"` });
      continue;
    }

    details.push({ path: key, message: `Unknown query parameter "${key}"` });
  }

  for (const numFilter of numericMap.values()) {
    if (
      numFilter.min !== undefined &&
      numFilter.max !== undefined &&
      numFilter.min > numFilter.max
    ) {
      details.push({
        path: `attr.${numFilter.code}.min`,
        message: `attr.${numFilter.code}.min must be less than or equal to attr.${numFilter.code}.max`,
      });
    }
  }

  const currencyRaw = getSingleStringParam(rawQuery, 'currency', details);
  let currency: SupportedCurrency = 'BRL';
  if (currencyRaw !== undefined) {
    const parsedCurrency = supportedCurrencySchema.safeParse(currencyRaw.trim().toUpperCase());
    if (!parsedCurrency.success) {
      details.push({ path: 'currency', message: 'currency must be one of: BRL, USD, EUR' });
    } else {
      currency = parsedCurrency.data;
    }
  }

  const categoryRaw = getSingleStringParam(rawQuery, 'category', details);
  let category: string | undefined;
  if (categoryRaw !== undefined) {
    const trimmed = categoryRaw.trim();
    if (trimmed.length === 0) {
      details.push({ path: 'category', message: 'category cannot be empty' });
    } else {
      category = trimmed;
    }
  }

  const minPrice = parseNonNegativeInt(
    getSingleStringParam(rawQuery, 'minPrice', details),
    'minPrice',
    details,
  );
  const maxPrice = parseNonNegativeInt(
    getSingleStringParam(rawQuery, 'maxPrice', details),
    'maxPrice',
    details,
  );

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    details.push({
      path: 'minPrice',
      message: 'minPrice must be less than or equal to maxPrice',
    });
  }

  const inStockRaw = getSingleStringParam(rawQuery, 'inStock', details);
  let inStock: boolean | undefined;
  if (inStockRaw !== undefined) {
    if (inStockRaw === 'true') {
      inStock = true;
    } else if (inStockRaw === 'false') {
      inStock = false;
    } else {
      details.push({ path: 'inStock', message: 'inStock must be "true" or "false"' });
    }
  }

  const qRaw = getSingleStringParam(rawQuery, 'q', details);
  let q: string | undefined;
  if (qRaw !== undefined) {
    const trimmed = qRaw.trim();
    if (trimmed.length > 0) {
      q = trimmed;
    }
  }

  if (details.length > 0) {
    throw validationError(details);
  }

  return {
    currency,
    category,
    minPrice,
    maxPrice,
    inStock,
    q,
    discreteAttributes: Array.from(discreteMap.values()),
    numericAttributes: Array.from(numericMap.values()),
  };
}

export function parseProductListQuery(
  rawQuery: Record<string, unknown>,
  attributeDefs: AttributeDefinitionInfo[],
): ParsedProductListQuery {
  const filters = parseCatalogFilters(rawQuery, attributeDefs, 'list');
  const details: ErrorDetail[] = [];

  const sortRaw = getSingleStringParam(rawQuery, 'sort', details);
  let sort: ProductSort = 'newest';
  if (sortRaw !== undefined) {
    const parsedSort = productSortSchema.safeParse(sortRaw);
    if (!parsedSort.success) {
      details.push({
        path: 'sort',
        message: 'sort must be one of: newest, price_asc, price_desc, name_asc, relevance',
      });
    } else {
      sort = parsedSort.data;
    }
  }

  if (sort === 'relevance' && !filters.q) {
    details.push({
      path: 'sort',
      message: 'sort=relevance is only allowed when query parameter "q" is provided',
    });
  }

  const limitRaw = getSingleStringParam(rawQuery, 'limit', details);
  let limit = 24;
  if (limitRaw !== undefined) {
    if (!/^\d+$/.test(limitRaw.trim())) {
      details.push({ path: 'limit', message: 'limit must be an integer between 1 and 60' });
    } else {
      const parsedLimit = Number(limitRaw.trim());
      if (parsedLimit < 1 || parsedLimit > 60) {
        details.push({ path: 'limit', message: 'limit must be between 1 and 60' });
      } else {
        limit = parsedLimit;
      }
    }
  }

  const cursorRaw = getSingleStringParam(rawQuery, 'cursor', details);

  if (details.length > 0) {
    throw validationError(details);
  }

  const cursor =
    cursorRaw !== undefined ? decodeCursor(cursorRaw, sort, filters.currency) : undefined;

  return {
    ...filters,
    sort,
    limit,
    cursor,
  };
}
