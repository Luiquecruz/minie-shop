import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type {
  CategoryDTO,
  CategoryRefDTO,
  FacetAttributeDTO,
  FacetCategoryDTO,
  FacetsDTO,
  ImageDTO,
  ProductAttributeDTO,
  ProductCardDTO,
  ProductDetailDTO,
  ProductListResponseDTO,
} from '@minieshop/contracts';
import { notFoundError } from '../../common/errors.js';
import { DatabaseService } from '../../database/database.service.js';
import {
  attributeDefinitions,
  categories,
  favorites,
  productImages,
  products,
} from '../../database/schema/index.js';
import { MediaService } from '../media/index.js';
import {
  buildProductFilterConditions,
  buildSearchRankSql,
  combineConditions,
  effectivePriceSql,
} from './catalog-filters.js';
import {
  encodeCursor,
  parseCatalogFilters,
  parseProductListQuery,
  type AttributeDefinitionInfo,
  type DecodedCursor,
} from './catalog-query.js';

interface CategoryRow {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  sortOrder: number;
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(MediaService)
    private readonly mediaService: MediaService,
  ) {}

  getModuleSummary(): { module: string; mediaModule: string } {
    return {
      module: 'catalog',
      mediaModule: this.mediaService.getModuleName(),
    };
  }

  async getAttributeDefinitions(): Promise<AttributeDefinitionInfo[]> {
    const rows = await this.databaseService.db
      .select({
        code: attributeDefinitions.code,
        label: attributeDefinitions.label,
        dataType: attributeDefinitions.dataType,
        unit: attributeDefinitions.unit,
        isFilterable: attributeDefinitions.isFilterable,
        showOnCard: attributeDefinitions.showOnCard,
        iconKey: attributeDefinitions.iconKey,
        sortOrder: attributeDefinitions.sortOrder,
      })
      .from(attributeDefinitions)
      .orderBy(asc(attributeDefinitions.sortOrder), asc(attributeDefinitions.code));

    return rows.map((row) => ({
      ...row,
      dataType: row.dataType as AttributeDefinitionInfo['dataType'],
    }));
  }

  async getAllCategories(): Promise<CategoryRow[]> {
    return this.databaseService.db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        slug: categories.slug,
        name: categories.name,
        sortOrder: categories.sortOrder,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  }

  resolveCategorySubtreeIds(allCategories: CategoryRow[], slug: string): string[] | null {
    const target = allCategories.find((c) => c.slug === slug);
    if (!target) {
      return null;
    }

    const childrenByParent = new Map<string | null, CategoryRow[]>();
    for (const row of allCategories) {
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row);
      childrenByParent.set(row.parentId, list);
    }

    const ids: string[] = [];
    const stack: string[] = [target.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      ids.push(current);
      const children = childrenByParent.get(current) ?? [];
      for (const child of children) {
        stack.push(child.id);
      }
    }
    return ids;
  }

  async loadReadyImagesByProductIds(productIds: string[]): Promise<Map<string, ImageDTO[]>> {
    const result = new Map<string, ImageDTO[]>();
    if (productIds.length === 0) {
      return result;
    }

    const links = await this.databaseService.db
      .select({
        productId: productImages.productId,
        mediaAssetId: productImages.mediaAssetId,
        altText: productImages.altText,
        position: productImages.position,
        isPrimary: productImages.isPrimary,
      })
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(
        desc(productImages.isPrimary),
        asc(productImages.position),
        asc(productImages.createdAt),
      );

    if (links.length === 0) {
      return result;
    }

    const assetIds = links.map((link) => link.mediaAssetId);
    const readyAssets = await this.mediaService.getReadyAssetsByIds(assetIds);

    for (const link of links) {
      const asset = readyAssets.get(link.mediaAssetId);
      if (!asset) {
        continue;
      }
      const list = result.get(link.productId) ?? [];
      list.push({
        id: asset.id,
        alt: link.altText,
        width: asset.width,
        height: asset.height,
        placeholder: asset.placeholder,
        variants: asset.variants,
      });
      result.set(link.productId, list);
    }

    return result;
  }

  mapProductAttributes(
    rawAttributes: Record<string, unknown>,
    defs: AttributeDefinitionInfo[],
    onlyCardHighlights: boolean,
  ): ProductAttributeDTO[] {
    const mapped: ProductAttributeDTO[] = [];
    for (const def of defs) {
      if (onlyCardHighlights && !def.showOnCard) {
        continue;
      }
      const rawValue = rawAttributes[def.code];
      if (
        typeof rawValue !== 'string' &&
        typeof rawValue !== 'number' &&
        typeof rawValue !== 'boolean'
      ) {
        continue;
      }

      mapped.push({
        code: def.code,
        label: def.label,
        value: rawValue,
        ...(def.unit ? { unit: def.unit } : {}),
        ...(def.iconKey ? { icon: def.iconKey } : {}),
      });
    }
    return mapped;
  }

  async getCategoryTree(): Promise<CategoryDTO[]> {
    const [categoryRows, directCounts] = await Promise.all([
      this.getAllCategories(),
      this.databaseService.db
        .select({
          categoryId: products.categoryId,
          total: count(),
        })
        .from(products)
        .where(eq(products.status, 'published'))
        .groupBy(products.categoryId),
    ]);

    const directCountByCategoryId = new Map<string, number>();
    for (const row of directCounts) {
      directCountByCategoryId.set(row.categoryId, Number(row.total));
    }

    const childrenByParentId = new Map<string | null, CategoryRow[]>();
    for (const row of categoryRows) {
      const siblings = childrenByParentId.get(row.parentId) ?? [];
      siblings.push(row);
      childrenByParentId.set(row.parentId, siblings);
    }

    const buildNode = (row: CategoryRow): CategoryDTO => {
      const childRows = childrenByParentId.get(row.id) ?? [];
      const children = childRows.map(buildNode);
      const directCount = directCountByCategoryId.get(row.id) ?? 0;
      const descendantsCount = children.reduce((sum, child) => sum + child.productCount, 0);

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        productCount: directCount + descendantsCount,
        children,
      };
    };

    const roots = childrenByParentId.get(null) ?? [];
    return roots.map(buildNode);
  }

  async listProducts(rawQuery: Record<string, unknown>): Promise<ProductListResponseDTO> {
    const [attrDefs, allCategories] = await Promise.all([
      this.getAttributeDefinitions(),
      this.getAllCategories(),
    ]);

    const query = parseProductListQuery(rawQuery, attrDefs);
    const categorySlugById = new Map(allCategories.map((c) => [c.id, c.slug]));

    let categoryIds: string[] | null | undefined;
    if (query.category !== undefined) {
      categoryIds = this.resolveCategorySubtreeIds(allCategories, query.category);
      if (!categoryIds || categoryIds.length === 0) {
        return { items: [], nextCursor: null };
      }
    }

    const conditions = buildProductFilterConditions({
      filters: query,
      categoryIds,
    });

    const rankSql = query.q !== undefined ? buildSearchRankSql(query.q) : sql<number>`0::real`;
    const createdAtIsoSql = sql<string>`to_char(${products.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

    if (query.cursor) {
      conditions.push(this.buildCursorCondition(query.cursor, rankSql));
    }

    const orderByClauses = this.buildOrderByClauses(query.sort, rankSql);

    const rows = await this.databaseService.db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        categoryId: products.categoryId,
        effectivePrice: effectivePriceSql,
        currency: products.currency,
        inStock: products.inStock,
        attributes: products.attributes,
        createdAtIso: createdAtIsoSql,
        rank: rankSql,
      })
      .from(products)
      .where(combineConditions(conditions))
      .orderBy(...orderByClauses)
      .limit(query.limit + 1);

    const hasNext = rows.length > query.limit;
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows;

    const productIds = pageRows.map((row) => row.id);
    const imagesByProductId = await this.loadReadyImagesByProductIds(productIds);

    const items: ProductCardDTO[] = pageRows.map((row) => {
      const productImgs = imagesByProductId.get(row.id) ?? [];
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        price: {
          amount: Number(row.effectivePrice),
          currency: row.currency,
        },
        inStock: row.inStock,
        image: productImgs[0] ?? null,
        highlights: this.mapProductAttributes(row.attributes ?? {}, attrDefs, true),
        categorySlug: categorySlugById.get(row.categoryId) ?? '',
      };
    });

    let nextCursor: string | null = null;
    if (hasNext && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1]!;
      const sortKey = this.extractCursorKey(query.sort, last);
      nextCursor = encodeCursor({
        s: query.sort,
        k: sortKey,
        id: last.id,
      });
    }

    return { items, nextCursor };
  }

  async getProductBySlug(slug: string): Promise<ProductDetailDTO> {
    const [productRows, attrDefs, allCategories] = await Promise.all([
      this.databaseService.db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          description: products.description,
          categoryId: products.categoryId,
          effectivePrice: effectivePriceSql,
          currency: products.currency,
          inStock: products.inStock,
          attributes: products.attributes,
        })
        .from(products)
        .where(and(eq(products.slug, slug), eq(products.status, 'published')))
        .limit(1),
      this.getAttributeDefinitions(),
      this.getAllCategories(),
    ]);

    const product = productRows[0];
    if (!product) {
      throw notFoundError(`Product "${slug}" not found`);
    }

    const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
    const currentCategory = categoriesById.get(product.categoryId);
    if (!currentCategory) {
      throw notFoundError(`Category for product "${slug}" not found`);
    }

    const breadcrumbs: CategoryRefDTO[] = [];
    let cursorCategory: CategoryRow | undefined = currentCategory;
    const visited = new Set<string>();
    while (cursorCategory && !visited.has(cursorCategory.id)) {
      visited.add(cursorCategory.id);
      breadcrumbs.unshift({ slug: cursorCategory.slug, name: cursorCategory.name });
      cursorCategory = cursorCategory.parentId
        ? categoriesById.get(cursorCategory.parentId)
        : undefined;
    }

    const imagesByProductId = await this.loadReadyImagesByProductIds([product.id]);
    const productImagesList = imagesByProductId.get(product.id) ?? [];

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: {
        amount: Number(product.effectivePrice),
        currency: product.currency,
      },
      inStock: product.inStock,
      category: {
        slug: currentCategory.slug,
        name: currentCategory.name,
      },
      breadcrumbs,
      images: productImagesList,
      attributes: this.mapProductAttributes(product.attributes ?? {}, attrDefs, false),
    };
  }

  async getFacets(rawQuery: Record<string, unknown>): Promise<FacetsDTO> {
    const [attrDefs, allCategories] = await Promise.all([
      this.getAttributeDefinitions(),
      this.getAllCategories(),
    ]);

    const filters = parseCatalogFilters(rawQuery, attrDefs, 'facets');

    let selectedCategoryIds: string[] | null | undefined;
    if (filters.category !== undefined) {
      selectedCategoryIds = this.resolveCategorySubtreeIds(allCategories, filters.category);
    }

    // 1. Price facet (disjunctive: ignores minPrice/maxPrice)
    const priceConditions = buildProductFilterConditions({
      filters,
      categoryIds: selectedCategoryIds,
      exclude: { price: true },
    });

    const pricePromise = this.databaseService.db
      .select({
        minPrice: sql<number | null>`MIN(${effectivePriceSql})`,
        maxPrice: sql<number | null>`MAX(${effectivePriceSql})`,
      })
      .from(products)
      .where(combineConditions(priceConditions));

    // 2. Category facet (disjunctive: ignores category filter, aggregates subtrees)
    const categoryConditions = buildProductFilterConditions({
      filters,
      categoryIds: selectedCategoryIds,
      exclude: { category: true },
    });

    const categoryCountsPromise = this.databaseService.db
      .select({
        categoryId: products.categoryId,
        total: count(),
      })
      .from(products)
      .where(combineConditions(categoryConditions))
      .groupBy(products.categoryId);

    // 3. Attribute facets (disjunctive: each filterable attribute ignores only its own filter)
    const filterableDefs = attrDefs.filter((def) => def.isFilterable);
    const attributePromises = filterableDefs.map(async (def): Promise<FacetAttributeDTO | null> => {
      const attrConditions = buildProductFilterConditions({
        filters,
        categoryIds: selectedCategoryIds,
        exclude: { attributeCode: def.code },
      });

      if (def.dataType === 'number') {
        const [rangeRow] = await this.databaseService.db
          .select({
            minVal: sql<number | null>`MIN((${products.attributes} ->> ${def.code})::double precision)`,
            maxVal: sql<number | null>`MAX((${products.attributes} ->> ${def.code})::double precision)`,
          })
          .from(products)
          .where(
            combineConditions([
              ...attrConditions,
              sql`jsonb_typeof(${products.attributes} -> ${def.code}) = 'number'`,
            ]),
          );

        if (rangeRow?.minVal === null || rangeRow?.maxVal === null || !rangeRow) {
          return null;
        }

        return {
          code: def.code,
          label: def.label,
          type: def.dataType,
          ...(def.unit ? { unit: def.unit } : {}),
          range: {
            min: Number(rangeRow.minVal),
            max: Number(rangeRow.maxVal),
          },
        };
      }

      const valueExpr = sql<string>`(${products.attributes} ->> ${def.code})`;
      const optionRows = await this.databaseService.db
        .select({
          value: valueExpr,
          total: count(),
        })
        .from(products)
        .where(
          combineConditions([
            ...attrConditions,
            sql`${products.attributes} ? ${def.code}`,
            sql`(${products.attributes} ->> ${def.code}) IS NOT NULL`,
          ]),
        )
        .groupBy(sql`1`)
        .orderBy(desc(count()), asc(sql`1`));

      if (optionRows.length === 0) {
        return null;
      }

      return {
        code: def.code,
        label: def.label,
        type: def.dataType,
        ...(def.unit ? { unit: def.unit } : {}),
        options: optionRows.map((row) => ({
          value: row.value,
          count: Number(row.total),
        })),
      };
    });

    const [priceRows, categoryCountRows, attributeResults] = await Promise.all([
      pricePromise,
      categoryCountsPromise,
      Promise.all(attributePromises),
    ]);

    const priceRow = priceRows[0];
    const directCountByCatId = new Map<string, number>();
    for (const row of categoryCountRows) {
      directCountByCatId.set(row.categoryId, Number(row.total));
    }

    // Aggregate subtree counts for every category so category.count === listProducts(?category=slug).length
    const childrenByParent = new Map<string | null, CategoryRow[]>();
    for (const cat of allCategories) {
      const list = childrenByParent.get(cat.parentId) ?? [];
      list.push(cat);
      childrenByParent.set(cat.parentId, list);
    }

    const subtreeCountById = new Map<string, number>();
    const computeSubtreeCount = (catId: string): number => {
      const cached = subtreeCountById.get(catId);
      if (cached !== undefined) {
        return cached;
      }
      const direct = directCountByCatId.get(catId) ?? 0;
      const children = childrenByParent.get(catId) ?? [];
      const total = direct + children.reduce((sum, child) => sum + computeSubtreeCount(child.id), 0);
      subtreeCountById.set(catId, total);
      return total;
    };

    const facetCategories: FacetCategoryDTO[] = [];
    for (const cat of allCategories) {
      const total = computeSubtreeCount(cat.id);
      if (total > 0) {
        facetCategories.push({
          slug: cat.slug,
          name: cat.name,
          count: total,
        });
      }
    }

    const attributes = attributeResults.filter((item): item is FacetAttributeDTO => item !== null);

    return {
      price: {
        min: priceRow && priceRow.minPrice !== null ? Number(priceRow.minPrice) : null,
        max: priceRow && priceRow.maxPrice !== null ? Number(priceRow.maxPrice) : null,
      },
      categories: facetCategories,
      attributes,
    };
  }

  private async assertPublishedProductExists(productId: string): Promise<void> {
    const existing = await this.databaseService.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.status, 'published')))
      .limit(1);

    if (existing.length === 0) {
      throw notFoundError(`Product "${productId}" not found`);
    }
  }

  async listFavoritesBySession(sessionId: string): Promise<string[]> {
    const rows = await this.databaseService.db
      .select({ productId: favorites.productId })
      .from(favorites)
      .innerJoin(products, eq(products.id, favorites.productId))
      .where(and(eq(favorites.sessionId, sessionId), eq(products.status, 'published')))
      .orderBy(desc(favorites.createdAt), asc(favorites.productId));

    return rows.map((row) => row.productId);
  }

  async addFavoriteForSession(sessionId: string, productId: string): Promise<void> {
    await this.assertPublishedProductExists(productId);

    await this.databaseService.db
      .insert(favorites)
      .values({
        productId,
        sessionId,
      })
      .onConflictDoNothing();
  }

  async removeFavoriteForSession(sessionId: string, productId: string): Promise<void> {
    await this.assertPublishedProductExists(productId);

    await this.databaseService.db
      .delete(favorites)
      .where(and(eq(favorites.sessionId, sessionId), eq(favorites.productId, productId)));
  }

  private buildOrderByClauses(sort: DecodedCursor['s'], rankSql: SQL<number>): SQL[] {
    switch (sort) {
      case 'price_asc':
        return [asc(effectivePriceSql), asc(products.id)];
      case 'price_desc':
        return [desc(effectivePriceSql), desc(products.id)];
      case 'name_asc':
        return [asc(products.name), asc(products.id)];
      case 'relevance':
        return [desc(rankSql), desc(products.id)];
      case 'newest':
      default:
        return [desc(products.createdAt), desc(products.id)];
    }
  }

  private buildCursorCondition(cursor: DecodedCursor, rankSql: SQL<number>): SQL {
    switch (cursor.s) {
      case 'price_asc': {
        const priceKey = Number(cursor.k);
        return sql`(${effectivePriceSql} > ${priceKey} OR (${effectivePriceSql} = ${priceKey} AND ${products.id} > ${cursor.id}::uuid))`;
      }
      case 'price_desc': {
        const priceKey = Number(cursor.k);
        return sql`(${effectivePriceSql} < ${priceKey} OR (${effectivePriceSql} = ${priceKey} AND ${products.id} < ${cursor.id}::uuid))`;
      }
      case 'name_asc': {
        const nameKey = String(cursor.k);
        return sql`(${products.name} > ${nameKey} OR (${products.name} = ${nameKey} AND ${products.id} > ${cursor.id}::uuid))`;
      }
      case 'relevance': {
        const rankKey = Number(cursor.k);
        return sql`(${rankSql} < ${rankKey}::real OR (${rankSql} = ${rankKey}::real AND ${products.id} < ${cursor.id}::uuid))`;
      }
      case 'newest':
      default: {
        const tsKey = String(cursor.k);
        return sql`(${products.createdAt} < ${tsKey}::timestamptz OR (${products.createdAt} = ${tsKey}::timestamptz AND ${products.id} < ${cursor.id}::uuid))`;
      }
    }
  }

  private extractCursorKey(
    sort: DecodedCursor['s'],
    row: { effectivePrice: number; name: string; createdAtIso: string; rank: number },
  ): string | number {
    switch (sort) {
      case 'price_asc':
      case 'price_desc':
        return Number(row.effectivePrice);
      case 'name_asc':
        return row.name;
      case 'relevance':
        return Number(row.rank);
      case 'newest':
      default:
        return row.createdAtIso;
    }
  }
}
