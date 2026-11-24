import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { products } from '../../database/schema/index.js';
import type { ParsedCatalogFilters } from './catalog-query.js';

export const effectivePriceSql = sql<number>`COALESCE(${products.specialPriceCents}, ${products.regularPriceCents})`;

export const searchVectorSql = sql`"catalog"."products"."search_vector"`;

export function buildSearchQuerySql(q: string): SQL {
  return sql`websearch_to_tsquery('portuguese', public.unaccent(${q}))`;
}

export function buildSearchRankSql(q: string): SQL<number> {
  return sql<number>`ts_rank(${searchVectorSql}, ${buildSearchQuerySql(q)})::real`;
}

export interface BuildFilterConditionsOptions {
  filters: ParsedCatalogFilters;
  categoryIds?: string[] | null;
  effectivePriceExpr?: SQL<number>;
  exclude?: {
    category?: boolean;
    price?: boolean;
    attributeCode?: string;
  };
}

export function buildProductFilterConditions(options: BuildFilterConditionsOptions): SQL[] {
  const { filters, categoryIds, exclude } = options;
  const priceExpr = options.effectivePriceExpr ?? effectivePriceSql;
  const conditions: SQL[] = [eq(products.status, 'published')];

  if (!exclude?.category && filters.category !== undefined) {
    if (!categoryIds || categoryIds.length === 0) {
      conditions.push(sql`FALSE`);
    } else {
      conditions.push(inArray(products.categoryId, categoryIds));
    }
  }

  if (!exclude?.price) {
    if (filters.minPrice !== undefined) {
      conditions.push(sql`${priceExpr} >= ${filters.minPrice}`);
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(sql`${priceExpr} <= ${filters.maxPrice}`);
    }
  }

  if (filters.inStock === true) {
    conditions.push(eq(products.inStock, true));
  } else if (filters.inStock === false) {
    conditions.push(eq(products.inStock, false));
  }

  if (filters.q !== undefined) {
    conditions.push(sql`${searchVectorSql} @@ ${buildSearchQuerySql(filters.q)}`);
  }

  for (const attr of filters.discreteAttributes) {
    if (exclude?.attributeCode === attr.code) {
      continue;
    }
    const valueParams = sql.join(
      attr.values.map((val) => sql`${val}`),
      sql`, `,
    );
    conditions.push(sql`(${products.attributes} ->> ${attr.code}) IN (${valueParams})`);
  }

  for (const attr of filters.numericAttributes) {
    if (exclude?.attributeCode === attr.code) {
      continue;
    }
    conditions.push(sql`jsonb_typeof(${products.attributes} -> ${attr.code}) = 'number'`);
    if (attr.min !== undefined) {
      conditions.push(
        sql`(${products.attributes} ->> ${attr.code})::double precision >= ${attr.min}`,
      );
    }
    if (attr.max !== undefined) {
      conditions.push(
        sql`(${products.attributes} ->> ${attr.code})::double precision <= ${attr.max}`,
      );
    }
  }

  return conditions;
}

export function combineConditions(conditions: SQL[]): SQL {
  return and(...conditions) ?? sql`TRUE`;
}
