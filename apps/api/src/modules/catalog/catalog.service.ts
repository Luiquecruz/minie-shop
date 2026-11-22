import { Inject, Injectable } from '@nestjs/common';
import { asc, count, eq } from 'drizzle-orm';
import type { CategoryDTO } from '@minieshop/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { categories, products } from '../../database/schema/index.js';
import { MediaService } from '../media/index.js';

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

  async getCategoryTree(): Promise<CategoryDTO[]> {
    const [categoryRows, directCounts] = await Promise.all([
      this.databaseService.db
        .select({
          id: categories.id,
          parentId: categories.parentId,
          slug: categories.slug,
          name: categories.name,
          sortOrder: categories.sortOrder,
        })
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
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
}
