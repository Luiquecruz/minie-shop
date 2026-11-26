import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { notFoundError, validationError } from '../../common/errors.js';
import { loadEnv } from '../../config/env.js';
import { DatabaseService } from '../../database/database.service.js';
import { categoryComplements, productRelations } from '../../database/schema/recommendations.js';
import { CatalogService } from '../catalog/index.js';
import { OutboxService } from '../platform/index.js';
import {
  clampScore,
  computeRuleRelatedScore,
  computeUpsellPriceBounds,
  formatScore,
  rankRuleRelated,
  rankRuleUpsell,
  selectDiverseCrossSell,
  sortRelationsForReading,
  type ComplementBucket,
  type RelationMethod,
  type RelationSource,
  type RelationType,
  type ScoredCandidate,
} from './relations-rules.js';

export const RELATION_POOL_SIZES: Record<RelationType, number> = {
  related: 20,
  upsell: 12,
  cross_sell: 16,
};

export interface RecomputeResult {
  productId: string;
  recomputed: boolean;
  method: 'vector' | 'rule' | null;
  counts: Record<RelationType, number>;
  reverseEnqueued: number;
}

export interface RelationsCoverageByType {
  totalRelations: number;
  manualRelations: number;
  autoVectorRelations: number;
  autoRuleRelations: number;
  productsWithAtLeast1: number;
  productsWithAtLeast3: number;
  productsWithAtLeast5: number;
  coverageAtLeast1Pct: number;
  coverageAtLeast3Pct: number;
  coverageAtLeast5Pct: number;
}

export interface RelationsStatusReport {
  publishedProducts: number;
  byType: Record<RelationType, RelationsCoverageByType>;
  byMethod: Record<RelationMethod, number>;
}

@Injectable()
export class RelationsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
    @Inject(OutboxService)
    private readonly outboxService: OutboxService,
  ) {}

  async recompute(
    productId: string,
    options?: { cascade?: boolean },
  ): Promise<RecomputeResult> {
    const env = loadEnv();
    const context = await this.catalogService.getPublishedProductRecommendationContext(productId);

    if (!context) {
      // Unpublished or deleted product: remove auto relations owned by this product
      await this.databaseService.db
        .delete(productRelations)
        .where(
          and(eq(productRelations.productId, productId), eq(productRelations.source, 'auto')),
        );

      return {
        productId,
        recomputed: false,
        method: null,
        counts: { related: 0, upsell: 0, cross_sell: 0 },
        reverseEnqueued: 0,
      };
    }

    // Load existing manual relations so we never duplicate or touch them
    const existingManualRows = await this.databaseService.db
      .select({
        relatedProductId: productRelations.relatedProductId,
        type: productRelations.type,
      })
      .from(productRelations)
      .where(
        and(eq(productRelations.productId, productId), eq(productRelations.source, 'manual')),
      );

    const manualByType: Record<RelationType, Set<string>> = {
      related: new Set<string>(),
      upsell: new Set<string>(),
      cross_sell: new Set<string>(),
    };

    for (const row of existingManualRows) {
      const t = row.type as RelationType;
      manualByType[t]?.add(row.relatedProductId);
    }

    const method: 'vector' | 'rule' = context.hasEmbedding ? 'vector' : 'rule';

    const [relatedCandidates, upsellCandidates, crossSellCandidates] = await Promise.all([
      this.computeRelatedCandidates(context, method, manualByType.related, env),
      this.computeUpsellCandidates(context, method, manualByType.upsell, env),
      this.computeCrossSellCandidates(context, method, manualByType.cross_sell, env),
    ]);

    const rowsToInsert: Array<{
      productId: string;
      relatedProductId: string;
      type: RelationType;
      source: 'auto';
      method: 'vector' | 'rule';
      score: string;
      position: number;
    }> = [];

    const appendRows = (type: RelationType, items: ScoredCandidate[]) => {
      items.forEach((item, index) => {
        if (item.productId === productId || manualByType[type].has(item.productId)) {
          return;
        }
        rowsToInsert.push({
          productId,
          relatedProductId: item.productId,
          type,
          source: 'auto',
          method,
          score: formatScore(item.score),
          position: index,
        });
      });
    };

    appendRows('related', relatedCandidates);
    appendRows('upsell', upsellCandidates);
    appendRows('cross_sell', crossSellCandidates);

    let reverseEnqueued = 0;

    await this.databaseService.db.transaction(async (tx) => {
      await tx
        .delete(productRelations)
        .where(
          and(eq(productRelations.productId, productId), eq(productRelations.source, 'auto')),
        );

      if (rowsToInsert.length > 0) {
        await tx.insert(productRelations).values(rowsToInsert).onConflictDoNothing();
      }

      if (options?.cascade !== false && env.RECOMMENDATIONS_REVERSE_FANOUT_LIMIT > 0) {
        const referencingRows = await tx
          .selectDistinct({ productId: productRelations.productId })
          .from(productRelations)
          .where(eq(productRelations.relatedProductId, productId))
          .limit(env.RECOMMENDATIONS_REVERSE_FANOUT_LIMIT);

        const reverseIds = referencingRows
          .map((row) => row.productId)
          .filter((id) => id !== productId);

        if (reverseIds.length > 0) {
          await this.outboxService.enqueueBatch(
            tx,
            reverseIds.map((refId) => ({
              eventType: 'product.changed' as const,
              aggregateType: 'product' as const,
              aggregateId: refId,
              payload: { productId: refId, cascade: false },
              consumers: ['recommendations'],
            })),
          );
          reverseEnqueued = reverseIds.length;
        }
      }
    });

    return {
      productId,
      recomputed: true,
      method,
      counts: {
        related: relatedCandidates.length,
        upsell: upsellCandidates.length,
        cross_sell: crossSellCandidates.length,
      },
      reverseEnqueued,
    };
  }

  async addManualRelation(input: {
    productSlug: string;
    relatedProductSlug: string;
    type: RelationType;
    position?: number;
  }): Promise<{
    id: string;
    productId: string;
    relatedProductId: string;
    type: RelationType;
    position: number;
  }> {
    const position = input.position ?? 0;
    if (!Number.isInteger(position) || position < 0) {
      throw validationError([
        { path: 'position', message: 'position must be a non-negative integer' },
      ]);
    }

    const [productId, relatedProductId] = await Promise.all([
      this.catalogService.getPublishedProductIdBySlug(input.productSlug),
      this.catalogService.getPublishedProductIdBySlug(input.relatedProductSlug),
    ]);

    if (!productId) {
      throw notFoundError(`Published product "${input.productSlug}" not found`);
    }
    if (!relatedProductId) {
      throw notFoundError(`Published product "${input.relatedProductSlug}" not found`);
    }
    if (productId === relatedProductId) {
      throw validationError([
        { path: 'relatedProductSlug', message: 'Cannot create a self-relation for a product' },
      ]);
    }

    const [row] = await this.databaseService.db
      .insert(productRelations)
      .values({
        productId,
        relatedProductId,
        type: input.type,
        source: 'manual',
        method: 'manual',
        score: null,
        position,
      })
      .onConflictDoUpdate({
        target: [
          productRelations.productId,
          productRelations.relatedProductId,
          productRelations.type,
        ],
        set: {
          source: 'manual',
          method: 'manual',
          score: null,
          position,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: productRelations.id,
        productId: productRelations.productId,
        relatedProductId: productRelations.relatedProductId,
        type: productRelations.type,
        position: productRelations.position,
      });

    if (!row) {
      throw new Error('Failed to upsert manual product relation');
    }

    return {
      ...row,
      type: row.type as RelationType,
    };
  }

  async removeManualRelation(input: {
    productSlug: string;
    relatedProductSlug: string;
    type: RelationType;
  }): Promise<{ deleted: boolean }> {
    const [productId, relatedProductId] = await Promise.all([
      this.catalogService.getPublishedProductIdBySlug(input.productSlug),
      this.catalogService.getPublishedProductIdBySlug(input.relatedProductSlug),
    ]);

    if (!productId || !relatedProductId) {
      return { deleted: false };
    }

    const deleted = await this.databaseService.db
      .delete(productRelations)
      .where(
        and(
          eq(productRelations.productId, productId),
          eq(productRelations.relatedProductId, relatedProductId),
          eq(productRelations.type, input.type),
          eq(productRelations.source, 'manual'),
        ),
      )
      .returning({ id: productRelations.id });

    return { deleted: deleted.length > 0 };
  }

  async rebuildAll(options?: {
    onProgress?: (info: { processed: number; total: number; productId: string }) => void;
  }): Promise<{ total: number; vectorCount: number; ruleCount: number }> {
    const productIds = await this.catalogService.listAllPublishedProductIds();
    let vectorCount = 0;
    let ruleCount = 0;

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i]!;
      const result = await this.recompute(productId, { cascade: false });
      if (result.method === 'vector') {
        vectorCount += 1;
      } else if (result.method === 'rule') {
        ruleCount += 1;
      }
      options?.onProgress?.({
        processed: i + 1,
        total: productIds.length,
        productId,
      });
    }

    return {
      total: productIds.length,
      vectorCount,
      ruleCount,
    };
  }

  async getStatus(): Promise<RelationsStatusReport> {
    const publishedIds = await this.catalogService.listAllPublishedProductIds();
    const publishedSet = new Set(publishedIds);
    const publishedCount = publishedIds.length;

    const allRows = await this.databaseService.db
      .select({
        productId: productRelations.productId,
        type: productRelations.type,
        source: productRelations.source,
        method: productRelations.method,
      })
      .from(productRelations);

    const byMethod: Record<RelationMethod, number> = {
      vector: 0,
      rule: 0,
      manual: 0,
    };

    const perTypePerProduct: Record<RelationType, Map<string, number>> = {
      related: new Map(),
      upsell: new Map(),
      cross_sell: new Map(),
    };

    const rawCounts: Record<
      RelationType,
      { total: number; manual: number; autoVector: number; autoRule: number }
    > = {
      related: { total: 0, manual: 0, autoVector: 0, autoRule: 0 },
      upsell: { total: 0, manual: 0, autoVector: 0, autoRule: 0 },
      cross_sell: { total: 0, manual: 0, autoVector: 0, autoRule: 0 },
    };

    for (const row of allRows) {
      if (!publishedSet.has(row.productId)) {
        continue;
      }
      const type = row.type as RelationType;
      const method = row.method as RelationMethod;
      byMethod[method] = (byMethod[method] ?? 0) + 1;

      const bucket = rawCounts[type];
      if (!bucket) continue;

      bucket.total += 1;
      if (row.source === 'manual') {
        bucket.manual += 1;
      } else if (method === 'vector') {
        bucket.autoVector += 1;
      } else {
        bucket.autoRule += 1;
      }

      const prodMap = perTypePerProduct[type];
      prodMap.set(row.productId, (prodMap.get(row.productId) ?? 0) + 1);
    }

    const buildTypeCoverage = (type: RelationType): RelationsCoverageByType => {
      const prodMap = perTypePerProduct[type];
      let ge1 = 0;
      let ge3 = 0;
      let ge5 = 0;
      for (const id of publishedIds) {
        const c = prodMap.get(id) ?? 0;
        if (c >= 1) ge1 += 1;
        if (c >= 3) ge3 += 1;
        if (c >= 5) ge5 += 1;
      }
      const pct = (n: number) =>
        publishedCount > 0 ? Math.round((n / publishedCount) * 1000) / 10 : 0;

      return {
        totalRelations: rawCounts[type].total,
        manualRelations: rawCounts[type].manual,
        autoVectorRelations: rawCounts[type].autoVector,
        autoRuleRelations: rawCounts[type].autoRule,
        productsWithAtLeast1: ge1,
        productsWithAtLeast3: ge3,
        productsWithAtLeast5: ge5,
        coverageAtLeast1Pct: pct(ge1),
        coverageAtLeast3Pct: pct(ge3),
        coverageAtLeast5Pct: pct(ge5),
      };
    };

    return {
      publishedProducts: publishedCount,
      byType: {
        related: buildTypeCoverage('related'),
        upsell: buildTypeCoverage('upsell'),
        cross_sell: buildTypeCoverage('cross_sell'),
      },
      byMethod,
    };
  }

  async getOrderedRelatedProductIds(params: {
    productId: string;
    types: RelationType[];
    overfetchLimit: number;
  }): Promise<Record<RelationType, string[]>> {
    const result: Record<RelationType, string[]> = {
      related: [],
      upsell: [],
      cross_sell: [],
    };

    if (params.types.length === 0) {
      return result;
    }

    const rows = await this.databaseService.db
      .select({
        relatedProductId: productRelations.relatedProductId,
        type: productRelations.type,
        source: productRelations.source,
        position: productRelations.position,
        score: productRelations.score,
      })
      .from(productRelations)
      .where(
        and(
          eq(productRelations.productId, params.productId),
          inArray(productRelations.type, params.types),
        ),
      );

    const grouped: Record<
      RelationType,
      Array<{
        relatedProductId: string;
        source: RelationSource;
        position: number;
        score: number | null;
      }>
    > = {
      related: [],
      upsell: [],
      cross_sell: [],
    };

    for (const row of rows) {
      const t = row.type as RelationType;
      grouped[t]?.push({
        relatedProductId: row.relatedProductId,
        source: row.source as RelationSource,
        position: row.position,
        score: row.score !== null ? Number(row.score) : null,
      });
    }

    for (const type of params.types) {
      const sorted = sortRelationsForReading(grouped[type]);
      result[type] = sorted.slice(0, params.overfetchLimit).map((r) => r.relatedProductId);
    }

    return result;
  }

  async getAggregatedCrossSellIds(params: {
    productIds: string[];
    overfetchLimit: number;
  }): Promise<string[]> {
    if (params.productIds.length === 0 || params.overfetchLimit <= 0) {
      return [];
    }

    const inputSet = new Set(params.productIds);
    const rows = await this.databaseService.db
      .select({
        relatedProductId: productRelations.relatedProductId,
        source: productRelations.source,
        position: productRelations.position,
        score: productRelations.score,
      })
      .from(productRelations)
      .where(
        and(
          inArray(productRelations.productId, params.productIds),
          eq(productRelations.type, 'cross_sell'),
        ),
      );

    const aggregated = new Map<
      string,
      { hasManual: boolean; bestManualPosition: number; scoreSum: number }
    >();

    for (const row of rows) {
      if (inputSet.has(row.relatedProductId)) {
        continue;
      }

      const current = aggregated.get(row.relatedProductId) ?? {
        hasManual: false,
        bestManualPosition: Number.MAX_SAFE_INTEGER,
        scoreSum: 0,
      };

      if (row.source === 'manual') {
        current.hasManual = true;
        current.bestManualPosition = Math.min(current.bestManualPosition, row.position);
      } else {
        current.scoreSum += row.score !== null ? Number(row.score) : 0;
      }

      aggregated.set(row.relatedProductId, current);
    }

    const sorted = Array.from(aggregated.entries()).sort((a, b) => {
      if (a[1].hasManual !== b[1].hasManual) {
        return a[1].hasManual ? -1 : 1;
      }
      if (a[1].hasManual && b[1].hasManual && a[1].bestManualPosition !== b[1].bestManualPosition) {
        return a[1].bestManualPosition - b[1].bestManualPosition;
      }
      if (b[1].scoreSum !== a[1].scoreSum) {
        return b[1].scoreSum - a[1].scoreSum;
      }
      return a[0].localeCompare(b[0]);
    });

    return sorted.slice(0, params.overfetchLimit).map(([id]) => id);
  }

  // --- Internal Computation Helpers ---

  private async computeRelatedCandidates(
    context: NonNullable<
      Awaited<ReturnType<CatalogService['getPublishedProductRecommendationContext']>>
    >,
    method: 'vector' | 'rule',
    manualExcluded: Set<string>,
    env: ReturnType<typeof loadEnv>,
  ): Promise<ScoredCandidate[]> {
    const poolLimit = RELATION_POOL_SIZES.related;
    const excludeIds = [context.id, ...manualExcluded];

    if (method === 'vector') {
      const seen = new Set<string>(excludeIds);
      const picked: ScoredCandidate[] = [];

      // 1. Same leaf category first
      const sameLeaf = await this.catalogService.findNearestPublishedNeighbors({
        productId: context.id,
        categoryIds: [context.categoryId],
        excludeProductIds: Array.from(seen),
        minSimilarity: env.RECOMMENDATIONS_RELATED_MIN_SIMILARITY,
        limit: poolLimit,
      });

      for (const n of sameLeaf) {
        if (picked.length >= poolLimit) break;
        seen.add(n.productId);
        picked.push({ productId: n.productId, score: n.similarity });
      }

      // 2. Sibling categories (same parent) next
      if (picked.length < poolLimit && context.siblingCategoryIds.length > 0) {
        const siblings = await this.catalogService.findNearestPublishedNeighbors({
          productId: context.id,
          categoryIds: context.siblingCategoryIds,
          excludeProductIds: Array.from(seen),
          minSimilarity: env.RECOMMENDATIONS_RELATED_MIN_SIMILARITY,
          limit: poolLimit - picked.length,
        });

        for (const n of siblings) {
          if (picked.length >= poolLimit) break;
          seen.add(n.productId);
          picked.push({ productId: n.productId, score: n.similarity });
        }
      }

      // 3. Global fallback above similarity threshold if pool still has space
      if (picked.length < poolLimit) {
        const globalNeighbors = await this.catalogService.findNearestPublishedNeighbors({
          productId: context.id,
          excludeProductIds: Array.from(seen),
          minSimilarity: env.RECOMMENDATIONS_RELATED_MIN_SIMILARITY,
          limit: poolLimit - picked.length,
        });

        for (const n of globalNeighbors) {
          if (picked.length >= poolLimit) break;
          seen.add(n.productId);
          picked.push({ productId: n.productId, score: n.similarity });
        }
      }

      return picked;
    }

    // Rule-based fallback: same leaf + sibling categories
    const scopeCategories = [context.categoryId, ...context.siblingCategoryIds];
    const candidates = await this.catalogService.listPublishedProductsByCategories({
      categoryIds: scopeCategories,
      excludeProductIds: excludeIds,
    });

    return rankRuleRelated({
      sourceCategoryId: context.categoryId,
      sourcePriceCents: context.effectivePriceCents,
      candidates,
      limit: poolLimit,
    });
  }

  private async computeUpsellCandidates(
    context: NonNullable<
      Awaited<ReturnType<CatalogService['getPublishedProductRecommendationContext']>>
    >,
    method: 'vector' | 'rule',
    manualExcluded: Set<string>,
    env: ReturnType<typeof loadEnv>,
  ): Promise<ScoredCandidate[]> {
    const poolLimit = RELATION_POOL_SIZES.upsell;
    const excludeIds = [context.id, ...manualExcluded];
    const bounds = computeUpsellPriceBounds(
      context.effectivePriceCents,
      env.RECOMMENDATIONS_UPSELL_MIN_RATIO,
      env.RECOMMENDATIONS_UPSELL_MAX_RATIO,
    );

    if (method === 'vector') {
      const neighbors = await this.catalogService.findNearestPublishedNeighbors({
        productId: context.id,
        categoryIds: [context.categoryId],
        excludeProductIds: excludeIds,
        minPriceCents: bounds.minPriceCents,
        maxPriceCents: bounds.maxPriceCents,
        minSimilarity: env.RECOMMENDATIONS_UPSELL_MIN_SIMILARITY,
        limit: poolLimit,
      });

      return neighbors.map((n) => ({ productId: n.productId, score: n.similarity }));
    }

    const candidates = await this.catalogService.listPublishedProductsByCategories({
      categoryIds: [context.categoryId],
      excludeProductIds: excludeIds,
      minPriceCents: bounds.minPriceCents,
      maxPriceCents: bounds.maxPriceCents,
    });

    return rankRuleUpsell({
      sourcePriceCents: context.effectivePriceCents,
      candidates,
      bounds,
      limit: poolLimit,
    });
  }

  private async computeCrossSellCandidates(
    context: NonNullable<
      Awaited<ReturnType<CatalogService['getPublishedProductRecommendationContext']>>
    >,
    method: 'vector' | 'rule',
    manualExcluded: Set<string>,
    env: ReturnType<typeof loadEnv>,
  ): Promise<ScoredCandidate[]> {
    const poolLimit = RELATION_POOL_SIZES.cross_sell;
    const excludeIds = [context.id, ...manualExcluded];

    // Resolve direct rules for categoryId first, then inherited rules from parentCategoryId
    const lookupCategoryIds = context.parentCategoryId
      ? [context.categoryId, context.parentCategoryId]
      : [context.categoryId];

    const ruleRows = await this.databaseService.db
      .select({
        categoryId: categoryComplements.categoryId,
        complementCategoryId: categoryComplements.complementCategoryId,
        position: categoryComplements.position,
      })
      .from(categoryComplements)
      .where(inArray(categoryComplements.categoryId, lookupCategoryIds))
      .orderBy(asc(categoryComplements.position));

    if (ruleRows.length === 0) {
      return [];
    }

    // Prioritize direct rules over parent-inherited rules, deduplicating complementCategoryId
    const orderedRules = [
      ...ruleRows.filter((r) => r.categoryId === context.categoryId),
      ...ruleRows.filter((r) => r.categoryId !== context.categoryId),
    ];

    const complementCategoryIds: string[] = [];
    const seenComplementCats = new Set<string>([context.categoryId]);
    for (const rule of orderedRules) {
      if (!seenComplementCats.has(rule.complementCategoryId)) {
        seenComplementCats.add(rule.complementCategoryId);
        complementCategoryIds.push(rule.complementCategoryId);
      }
    }

    if (complementCategoryIds.length === 0) {
      return [];
    }

    const allCategories = await this.catalogService.getCategoryHierarchyMap();
    const resolveSubtree = (rootId: string): string[] => {
      const result: string[] = [];
      const queue = [rootId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        result.push(curr);
        for (const cat of allCategories) {
          if (cat.parentId === curr) {
            queue.push(cat.id);
          }
        }
      }
      return result;
    };

    const buckets: ComplementBucket[] = [];

    for (const compCatId of complementCategoryIds) {
      const targetCategoryIds = resolveSubtree(compCatId).filter(
        (id) => id !== context.categoryId,
      );
      if (targetCategoryIds.length === 0) {
        continue;
      }

      if (method === 'vector') {
        const neighbors = await this.catalogService.findNearestPublishedNeighbors({
          productId: context.id,
          categoryIds: targetCategoryIds,
          excludeProductIds: excludeIds,
          limit: env.RECOMMENDATIONS_CROSS_SELL_MAX_PER_CATEGORY * 2,
        });

        if (neighbors.length > 0) {
          buckets.push({
            complementCategoryId: compCatId,
            candidates: neighbors.map((n) => ({
              productId: n.productId,
              score: clampScore(n.similarity),
            })),
          });
        }
      } else {
        const candidates = await this.catalogService.listPublishedProductsByCategories({
          categoryIds: targetCategoryIds,
          excludeProductIds: excludeIds,
        });

        if (candidates.length > 0) {
          let newestMs = -Infinity;
          let oldestMs = Infinity;
          for (const c of candidates) {
            const t = c.createdAt.getTime();
            if (t > newestMs) newestMs = t;
            if (t < oldestMs) oldestMs = t;
          }

          const scored = candidates
            .map((c) => ({
              productId: c.productId,
              score: computeRuleRelatedScore({
                sourcePriceCents: context.effectivePriceCents,
                candidatePriceCents: c.effectivePriceCents,
                candidateCreatedAt: c.createdAt,
                newestCreatedAtMs: newestMs,
                oldestCreatedAtMs: oldestMs,
                tierBoost: 1.0,
              }),
            }))
            .sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId));

          buckets.push({
            complementCategoryId: compCatId,
            candidates: scored,
          });
        }
      }
    }

    return selectDiverseCrossSell({
      buckets,
      maxPerCategory: env.RECOMMENDATIONS_CROSS_SELL_MAX_PER_CATEGORY,
      limit: poolLimit,
    });
  }

  /**
   * Direct helper for testing EXPLAIN ANALYZE on filtered HNSW iterative_scan queries.
   */
  async verifyDatabaseConnection(): Promise<boolean> {
    await this.databaseService.db.execute(sql`SELECT 1`);
    return true;
  }
}
