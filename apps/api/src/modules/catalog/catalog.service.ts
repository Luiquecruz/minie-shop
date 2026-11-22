import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type {
  CategoryDTO,
  CategoryRefDTO,
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
