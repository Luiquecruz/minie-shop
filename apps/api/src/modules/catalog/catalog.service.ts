import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, inArray, sql, type SQL } from 'drizzle-orm';
import {
  searchIndexDocumentSchema,
  type CategoryDTO,
  type CategoryRefDTO,
  type FacetAttributeDTO,
  type FacetCategoryDTO,
  type FacetsDTO,
  type ImageDTO,
  type ProductAttributeDTO,
  type ProductCardDTO,
  type ProductDetailDTO,
  type ProductListResponseDTO,
  type SearchIndexDocument,
} from '@minieshop/contracts';
import { notFoundError } from '../../common/errors.js';
import { DatabaseService } from '../../database/database.service.js';
import {
  attributeDefinitions,
  categories,
  favorites,
  productEmbeddings,
  productImages,
  products,
} from '../../database/schema/index.js';
import { MediaService } from '../media/index.js';
import { OutboxService, type DbOrTx } from '../platform/index.js';
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
    @Optional()
    @Inject(OutboxService)
    private readonly outboxService?: OutboxService,
  ) { }

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

  async listFavoritesByCustomer(customerId: string): Promise<string[]> {
    const rows = await this.databaseService.db
      .select({ productId: favorites.productId })
      .from(favorites)
      .innerJoin(products, eq(products.id, favorites.productId))
      .where(and(eq(favorites.customerId, customerId), eq(products.status, 'published')))
      .orderBy(desc(favorites.createdAt), asc(favorites.productId));

    return rows.map((row) => row.productId);
  }

  async addFavoriteForCustomer(customerId: string, productId: string): Promise<void> {
    await this.assertPublishedProductExists(productId);

    await this.databaseService.db
      .insert(favorites)
      .values({
        productId,
        customerId,
      })
      .onConflictDoNothing();
  }

  async removeFavoriteForCustomer(customerId: string, productId: string): Promise<void> {
    await this.assertPublishedProductExists(productId);

    await this.databaseService.db
      .delete(favorites)
      .where(and(eq(favorites.customerId, customerId), eq(favorites.productId, productId)));
  }

  /**
   * Public cross-module interface (I06): atomically merges anonymous favorites into a customer account
   * within the caller's database transaction without creating duplicates.
   */
  async mergeAnonymousFavorites(
    tx: DbOrTx,
    sessionId: string,
    customerId: string,
  ): Promise<{ merged: number }> {
    const anonRows = await tx
      .select({ productId: favorites.productId })
      .from(favorites)
      .where(eq(favorites.sessionId, sessionId));

    if (anonRows.length === 0) {
      return { merged: 0 };
    }

    for (const row of anonRows) {
      await tx
        .insert(favorites)
        .values({
          productId: row.productId,
          customerId,
        })
        .onConflictDoNothing();
    }

    await tx.delete(favorites).where(eq(favorites.sessionId, sessionId));

    return { merged: anonRows.length };
  }

  // --- Public interfaces for Search & Outbox modules (ADR-0006 / S04) ---

  private buildCategoryAncestry(
    categoryId: string,
    categoriesById: Map<string, CategoryRow>,
  ): { pathSlugs: string[]; names: string[] } {
    const pathSlugs: string[] = [];
    const names: string[] = [];
    const visited = new Set<string>();
    let current = categoriesById.get(categoryId);

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      pathSlugs.unshift(current.slug);
      names.unshift(current.name);
      current = current.parentId ? categoriesById.get(current.parentId) : undefined;
    }

    return { pathSlugs, names };
  }

  private buildAttributesText(
    rawAttributes: Record<string, unknown>,
    defs: AttributeDefinitionInfo[],
  ): string {
    const parts: string[] = [];
    for (const def of defs) {
      if (!def.isFilterable && !def.showOnCard) {
        continue;
      }
      const val = rawAttributes[def.code];
      if (typeof val === 'string' && val.trim().length > 0) {
        parts.push(`${def.label}: ${val.trim()}`);
      } else if (typeof val === 'number') {
        parts.push(`${def.label}: ${val}${def.unit ? ` ${def.unit}` : ''}`);
      } else if (typeof val === 'boolean' && val) {
        parts.push(def.label);
      }
    }
    return parts.join(' | ');
  }

  async getIndexableProductById(productId: string): Promise<SearchIndexDocument | null> {
    const docs = await this.getIndexableProductsByIds([productId]);
    return docs[0] ?? null;
  }

  async getIndexableProductsByIds(productIds: string[]): Promise<SearchIndexDocument[]> {
    if (productIds.length === 0) {
      return [];
    }

    const [rows, allCategories, attrDefs] = await Promise.all([
      this.databaseService.db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          description: products.description,
          categoryId: products.categoryId,
          effectivePrice: effectivePriceSql,
          inStock: products.inStock,
          attributes: products.attributes,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(and(inArray(products.id, productIds), eq(products.status, 'published'))),
      this.getAllCategories(),
      this.getAttributeDefinitions(),
    ]);

    const categoriesById = new Map(allCategories.map((c) => [c.id, c]));

    return rows.map((row) => {
      const { pathSlugs, names } = this.buildCategoryAncestry(row.categoryId, categoriesById);
      const attrs = row.attributes ?? {};
      const brandRaw = attrs.brand;
      const brand = typeof brandRaw === 'string' && brandRaw.trim().length > 0 ? brandRaw.trim() : undefined;

      return searchIndexDocumentSchema.parse({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        ...(brand ? { brand } : {}),
        categoryPath: pathSlugs,
        categoryNames: names.join(' > '),
        attributesText: this.buildAttributesText(attrs, attrDefs),
        price: Number(row.effectivePrice),
        inStock: row.inStock,
        createdAt: Math.floor(new Date(row.createdAt).getTime()),
      });
    });
  }

  async listIndexableProductIdsBatch(params: {
    afterId?: string;
    limit: number;
  }): Promise<string[]> {
    const conditions: SQL[] = [eq(products.status, 'published')];
    if (params.afterId) {
      conditions.push(gt(products.id, params.afterId));
    }

    const rows = await this.databaseService.db
      .select({ id: products.id })
      .from(products)
      .where(combineConditions(conditions))
      .orderBy(asc(products.id))
      .limit(params.limit);

    return rows.map((row) => row.id);
  }

  async listAllPublishedProductIds(): Promise<string[]> {
    const rows = await this.databaseService.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.status, 'published'))
      .orderBy(asc(products.id));

    return rows.map((row) => row.id);
  }

  async listProductIdsByCategorySubtree(categoryId: string): Promise<string[]> {
    const allCategories = await this.getAllCategories();
    const target = allCategories.find((c) => c.id === categoryId);
    if (!target) {
      return [];
    }
    const subtreeIds = this.resolveCategorySubtreeIds(allCategories, target.slug);
    if (!subtreeIds || subtreeIds.length === 0) {
      return [];
    }

    const rows = await this.databaseService.db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.categoryId, subtreeIds));

    return rows.map((row) => row.id);
  }

  async getProductCardsByIdsOrdered(productIds: string[]): Promise<ProductCardDTO[]> {
    if (productIds.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(productIds));
    const [rows, allCategories, attrDefs, imagesByProductId] = await Promise.all([
      this.databaseService.db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          categoryId: products.categoryId,
          effectivePrice: effectivePriceSql,
          currency: products.currency,
          inStock: products.inStock,
          attributes: products.attributes,
        })
        .from(products)
        .where(and(inArray(products.id, uniqueIds), eq(products.status, 'published'))),
      this.getAllCategories(),
      this.getAttributeDefinitions(),
      this.loadReadyImagesByProductIds(uniqueIds),
    ]);

    const categorySlugById = new Map(allCategories.map((c) => [c.id, c.slug]));
    const cardById = new Map<string, ProductCardDTO>();

    for (const row of rows) {
      const productImgs = imagesByProductId.get(row.id) ?? [];
      cardById.set(row.id, {
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
      });
    }

    const ordered: ProductCardDTO[] = [];
    for (const id of productIds) {
      const card = cardById.get(id);
      if (card) {
        ordered.push(card);
      }
    }
    return ordered;
  }

  async searchProductsPostgresFallback(params: {
    q: string;
    limit: number;
    offset: number;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  }): Promise<{ items: ProductCardDTO[]; estimatedTotal: number }> {
    const allCategories = await this.getAllCategories();
    let categoryIds: string[] | null | undefined;
    if (params.category !== undefined) {
      categoryIds = this.resolveCategorySubtreeIds(allCategories, params.category);
      if (!categoryIds || categoryIds.length === 0) {
        return { items: [], estimatedTotal: 0 };
      }
    }

    const conditions = buildProductFilterConditions({
      filters: {
        category: params.category,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        inStock: params.inStock,
        q: params.q,
        discreteAttributes: [],
        numericAttributes: [],
      },
      categoryIds,
    });

    const whereClause = combineConditions(conditions);
    const rankSql = buildSearchRankSql(params.q);

    const [countResult, idRows] = await Promise.all([
      this.databaseService.db.select({ total: count() }).from(products).where(whereClause),
      this.databaseService.db
        .select({ id: products.id })
        .from(products)
        .where(whereClause)
        .orderBy(desc(rankSql), desc(products.id))
        .limit(params.limit)
        .offset(params.offset),
    ]);

    const ids = idRows.map((row) => row.id);
    const items = await this.getProductCardsByIdsOrdered(ids);

    return {
      items,
      estimatedTotal: Number(countResult[0]?.total ?? 0),
    };
  }

  async suggestProductsPostgresFallback(
    q: string,
    limit: number,
  ): Promise<Array<{ slug: string; name: string; categoryName: string }>> {
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      return [];
    }

    const allCategories = await this.getAllCategories();
    const categoryNameById = new Map(allCategories.map((c) => [c.id, c.name]));
    const likePattern = `%${trimmed}%`;

    const rows = await this.databaseService.db
      .select({
        slug: products.slug,
        name: products.name,
        categoryId: products.categoryId,
      })
      .from(products)
      .where(
        and(
          eq(products.status, 'published'),
          sql`(public.unaccent(${products.name}) ILIKE public.unaccent(${likePattern}) OR "catalog"."products"."search_vector" @@ websearch_to_tsquery('portuguese', public.unaccent(${trimmed})))`,
        ),
      )
      .orderBy(asc(products.name))
      .limit(limit);

    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      categoryName: categoryNameById.get(row.categoryId) ?? '',
    }));
  }

  // --- Transactional Catalog Write Use Cases emitting Outbox events (S05) ---

  async createProduct(input: {
    categoryId: string;
    slug: string;
    sku: string;
    name: string;
    description: string;
    regularPriceCents: number;
    specialPriceCents?: number | null;
    currency?: string;
    inStock?: boolean;
    status?: 'draft' | 'published' | 'archived';
    attributes?: Record<string, unknown>;
  }): Promise<{ id: string; slug: string }> {
    return this.databaseService.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(products)
        .values({
          categoryId: input.categoryId,
          slug: input.slug,
          sku: input.sku,
          name: input.name,
          description: input.description,
          regularPriceCents: input.regularPriceCents,
          specialPriceCents: input.specialPriceCents ?? null,
          currency: input.currency ?? 'BRL',
          inStock: input.inStock ?? false,
          status: input.status ?? 'published',
          attributes: input.attributes ?? {},
        })
        .returning({ id: products.id, slug: products.slug });

      if (!created) {
        throw new Error('Failed to create product');
      }

      if (this.outboxService) {
        await this.outboxService.enqueue(tx, {
          eventType: 'product.changed',
          aggregateType: 'product',
          aggregateId: created.id,
          payload: { productId: created.id },
        });
      }

      return created;
    });
  }

  async updateProduct(
    productId: string,
    patch: {
      name?: string;
      description?: string;
      categoryId?: string;
      regularPriceCents?: number;
      specialPriceCents?: number | null;
      inStock?: boolean;
      status?: 'draft' | 'published' | 'archived';
      attributes?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.databaseService.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(products)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId))
        .returning({ id: products.id });

      if (!updated) {
        throw notFoundError(`Product "${productId}" not found`);
      }

      if (this.outboxService) {
        await this.outboxService.enqueue(tx, {
          eventType: 'product.changed',
          aggregateType: 'product',
          aggregateId: productId,
          payload: { productId },
        });
      }
    });
  }

  async setProductStatus(
    productId: string,
    status: 'draft' | 'published' | 'archived',
  ): Promise<void> {
    await this.updateProduct(productId, { status });
  }

  async updateProductInStock(productId: string, inStock: boolean): Promise<void> {
    await this.updateProduct(productId, { inStock });
  }

  async deleteProduct(productId: string): Promise<void> {
    await this.databaseService.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(products)
        .where(eq(products.id, productId))
        .returning({ id: products.id });

      if (deleted.length === 0) {
        throw notFoundError(`Product "${productId}" not found`);
      }

      if (this.outboxService) {
        await this.outboxService.enqueue(tx, {
          eventType: 'product.changed',
          aggregateType: 'product',
          aggregateId: productId,
          payload: { productId },
        });
      }
    });
  }

  async updateCategory(
    categoryId: string,
    patch: {
      name?: string;
      slug?: string;
      parentId?: string | null;
      sortOrder?: number;
    },
  ): Promise<void> {
    await this.databaseService.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(categories)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, categoryId))
        .returning({ id: categories.id });

      if (!updated) {
        throw notFoundError(`Category "${categoryId}" not found`);
      }

      if (this.outboxService) {
        await this.outboxService.enqueue(tx, {
          eventType: 'category.changed',
          aggregateType: 'category',
          aggregateId: categoryId,
          payload: { categoryId },
        });
      }
    });
  }

  // --- Public Embedding Persistence Interface (catalog owns catalog.product_embeddings, S06) ---

  async getProductEmbeddingMeta(
    productId: string,
  ): Promise<{ model: string; contentHash: string } | null> {
    const [row] = await this.databaseService.db
      .select({
        model: productEmbeddings.model,
        contentHash: productEmbeddings.contentHash,
      })
      .from(productEmbeddings)
      .where(eq(productEmbeddings.productId, productId))
      .limit(1);

    return row ?? null;
  }

  async getProductEmbeddingsByIds(
    productIds: string[],
  ): Promise<Map<string, { embedding: number[]; model: string; contentHash: string }>> {
    const result = new Map<string, { embedding: number[]; model: string; contentHash: string }>();
    if (productIds.length === 0) {
      return result;
    }

    const rows = await this.databaseService.db
      .select({
        productId: productEmbeddings.productId,
        embedding: productEmbeddings.embedding,
        model: productEmbeddings.model,
        contentHash: productEmbeddings.contentHash,
      })
      .from(productEmbeddings)
      .where(inArray(productEmbeddings.productId, productIds));

    for (const row of rows) {
      result.set(row.productId, {
        embedding: row.embedding,
        model: row.model,
        contentHash: row.contentHash,
      });
    }
    return result;
  }

  async upsertProductEmbedding(input: {
    productId: string;
    embedding: number[];
    model: string;
    contentHash: string;
  }): Promise<void> {
    await this.databaseService.db
      .insert(productEmbeddings)
      .values({
        productId: input.productId,
        embedding: input.embedding,
        model: input.model,
        contentHash: input.contentHash,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: productEmbeddings.productId,
        set: {
          embedding: input.embedding,
          model: input.model,
          contentHash: input.contentHash,
          updatedAt: new Date(),
        },
      });
  }

  async deleteProductEmbedding(productId: string): Promise<void> {
    await this.databaseService.db
      .delete(productEmbeddings)
      .where(eq(productEmbeddings.productId, productId));
  }

  // --- Public Recommendations Query Interface (R03, no cross-schema JOINs) ---

  async getPublishedProductIdBySlug(slug: string): Promise<string | null> {
    const [row] = await this.databaseService.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.status, 'published')))
      .limit(1);
    return row?.id ?? null;
  }

  async getCategoryHierarchyMap(): Promise<
    Array<{ id: string; slug: string; parentId: string | null }>
  > {
    const all = await this.getAllCategories();
    return all.map((c) => ({ id: c.id, slug: c.slug, parentId: c.parentId }));
  }

  async getPublishedProductRecommendationContext(productId: string): Promise<{
    id: string;
    slug: string;
    name: string;
    categoryId: string;
    parentCategoryId: string | null;
    siblingCategoryIds: string[];
    effectivePriceCents: number;
    createdAt: Date;
    hasEmbedding: boolean;
  } | null> {
    const [row] = await this.databaseService.db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        categoryId: products.categoryId,
        effectivePrice: effectivePriceSql,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.status, 'published')))
      .limit(1);

    if (!row) {
      return null;
    }

    const [allCategories, embMeta] = await Promise.all([
      this.getAllCategories(),
      this.getProductEmbeddingMeta(productId),
    ]);

    const currentCat = allCategories.find((c) => c.id === row.categoryId);
    const parentCategoryId = currentCat?.parentId ?? null;
    const siblingCategoryIds = parentCategoryId
      ? allCategories
        .filter((c) => c.parentId === parentCategoryId && c.id !== row.categoryId)
        .map((c) => c.id)
      : [];

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      categoryId: row.categoryId,
      parentCategoryId,
      siblingCategoryIds,
      effectivePriceCents: Number(row.effectivePrice),
      createdAt: row.createdAt,
      hasEmbedding: embMeta !== null,
    };
  }

  async findNearestPublishedNeighbors(params: {
    productId: string;
    categoryIds?: string[];
    excludeProductIds?: string[];
    minPriceCents?: number;
    maxPriceCents?: number;
    minSimilarity?: number;
    limit: number;
  }): Promise<
    Array<{
      productId: string;
      categoryId: string;
      effectivePriceCents: number;
      similarity: number;
      createdAt: Date;
    }>
  > {
    if (params.limit <= 0) {
      return [];
    }
    if (params.categoryIds && params.categoryIds.length === 0) {
      return [];
    }

    const targetMap = await this.getProductEmbeddingsByIds([params.productId]);
    const target = targetMap.get(params.productId);
    if (!target) {
      return [];
    }

    const vectorLiteral = `[${target.embedding.join(',')}]`;
    const excludedIds = Array.from(new Set([params.productId, ...(params.excludeProductIds ?? [])]));

    const conditions: SQL[] = [
      eq(products.status, 'published'),
      sql`${products.id} NOT IN (${sql.join(
        excludedIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    ];

    if (params.categoryIds && params.categoryIds.length > 0) {
      conditions.push(inArray(products.categoryId, params.categoryIds));
    }
    if (params.minPriceCents !== undefined) {
      conditions.push(sql`${effectivePriceSql} >= ${params.minPriceCents}`);
    }
    if (params.maxPriceCents !== undefined) {
      conditions.push(sql`${effectivePriceSql} <= ${params.maxPriceCents}`);
    }

    const distanceExpr = sql<number>`(${productEmbeddings.embedding} <=> ${vectorLiteral}::vector)`;
    const similarityExpr = sql<number>`(1 - (${productEmbeddings.embedding} <=> ${vectorLiteral}::vector))`;

    // pgvector 0.8.7 supports hnsw.iterative_scan so filtered kNN never shrinks result sets
    const rows = await this.databaseService.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`);
      return tx
        .select({
          productId: products.id,
          categoryId: products.categoryId,
          effectivePrice: effectivePriceSql,
          similarity: similarityExpr,
          createdAt: products.createdAt,
        })
        .from(productEmbeddings)
        .innerJoin(products, eq(products.id, productEmbeddings.productId))
        .where(and(...conditions))
        .orderBy(asc(distanceExpr), asc(products.id))
        .limit(params.limit);
    });

    const mapped = rows.map((row) => ({
      productId: row.productId,
      categoryId: row.categoryId,
      effectivePriceCents: Number(row.effectivePrice),
      similarity: Math.max(0, Math.min(1, Number(row.similarity))),
      createdAt: row.createdAt,
    }));

    if (params.minSimilarity !== undefined) {
      return mapped.filter((row) => row.similarity >= params.minSimilarity!);
    }
    return mapped;
  }

  async listPublishedProductsByCategories(params: {
    categoryIds?: string[];
    excludeProductIds?: string[];
    minPriceCents?: number;
    maxPriceCents?: number;
    limit?: number;
  }): Promise<
    Array<{
      productId: string;
      categoryId: string;
      effectivePriceCents: number;
      createdAt: Date;
    }>
  > {
    if (params.categoryIds && params.categoryIds.length === 0) {
      return [];
    }

    const conditions: SQL[] = [eq(products.status, 'published')];

    if (params.excludeProductIds && params.excludeProductIds.length > 0) {
      conditions.push(
        sql`${products.id} NOT IN (${sql.join(
          params.excludeProductIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`,
      );
    }
    if (params.categoryIds && params.categoryIds.length > 0) {
      conditions.push(inArray(products.categoryId, params.categoryIds));
    }
    if (params.minPriceCents !== undefined) {
      conditions.push(sql`${effectivePriceSql} >= ${params.minPriceCents}`);
    }
    if (params.maxPriceCents !== undefined) {
      conditions.push(sql`${effectivePriceSql} <= ${params.maxPriceCents}`);
    }

    const baseQuery = this.databaseService.db
      .select({
        productId: products.id,
        categoryId: products.categoryId,
        effectivePrice: effectivePriceSql,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.createdAt), asc(products.id));

    const rows = params.limit !== undefined ? await baseQuery.limit(params.limit) : await baseQuery;

    return rows.map((row) => ({
      productId: row.productId,
      categoryId: row.categoryId,
      effectivePriceCents: Number(row.effectivePrice),
      createdAt: row.createdAt,
    }));
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
