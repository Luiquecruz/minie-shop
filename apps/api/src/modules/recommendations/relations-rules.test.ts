import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeUpsellPriceBounds,
  rankRuleRelated,
  rankRuleUpsell,
  selectDiverseCrossSell,
  sortRelationsForReading,
} from './relations-rules.js';

describe('R06 — Pure Recommendation Rules Unit Tests', () => {
  it('computeUpsellPriceBounds computes strictly higher min/max cents from ratios', () => {
    const bounds = computeUpsellPriceBounds(20000, 1.1, 2.5);
    assert.equal(bounds.minPriceCents, 22000);
    assert.equal(bounds.maxPriceCents, 50000);

    // Even when minRatio is 1.0, minPriceCents is strictly greater than base
    const tight = computeUpsellPriceBounds(10000, 1.0, 1.2);
    assert.equal(tight.minPriceCents, 10001);
    assert.equal(tight.maxPriceCents, 12000);
  });

  it('rankRuleRelated prioritizes same leaf over siblings, then price proximity and recency', () => {
    const tOld = new Date('2026-01-01T00:00:00Z');
    const tNew = new Date('2026-11-01T00:00:00Z');

    const ranked = rankRuleRelated({
      sourceCategoryId: 'cat-audio',
      sourcePriceCents: 20000,
      limit: 5,
      candidates: [
        { productId: 'sibling-close', categoryId: 'cat-wearables', effectivePriceCents: 20000, createdAt: tNew },
        { productId: 'leaf-far', categoryId: 'cat-audio', effectivePriceCents: 50000, createdAt: tOld },
        { productId: 'leaf-close', categoryId: 'cat-audio', effectivePriceCents: 21000, createdAt: tNew },
      ],
    });

    assert.deepEqual(
      ranked.map((r) => r.productId),
      ['leaf-close', 'leaf-far', 'sibling-close'],
    );
  });

  it('rankRuleUpsell filters strictly to price bounds and favors the ideal 1.35x step', () => {
    const t = new Date('2026-06-01T00:00:00Z');
    const bounds = computeUpsellPriceBounds(20000, 1.1, 2.5);

    const ranked = rankRuleUpsell({
      sourcePriceCents: 20000,
      bounds,
      limit: 5,
      candidates: [
        { productId: 'too-cheap', categoryId: 'c1', effectivePriceCents: 21000, createdAt: t },
        { productId: 'ideal-step', categoryId: 'c1', effectivePriceCents: 27000, createdAt: t },
        { productId: 'high-valid', categoryId: 'c1', effectivePriceCents: 49000, createdAt: t },
        { productId: 'too-expensive', categoryId: 'c1', effectivePriceCents: 60000, createdAt: t },
      ],
    });

    assert.deepEqual(
      ranked.map((r) => r.productId),
      ['ideal-step', 'high-valid'],
    );
  });

  it('selectDiverseCrossSell enforces maxPerCategory round-robin diversity and deduplicates IDs', () => {
    const picked = selectDiverseCrossSell({
      maxPerCategory: 2,
      limit: 5,
      buckets: [
        {
          complementCategoryId: 'cat-a',
          candidates: [
            { productId: 'a1', score: 0.9 },
            { productId: 'a2', score: 0.8 },
            { productId: 'a3', score: 0.7 },
          ],
        },
        {
          complementCategoryId: 'cat-b',
          candidates: [
            { productId: 'a1', score: 0.95 }, // duplicate across buckets
            { productId: 'b1', score: 0.85 },
            { productId: 'b2', score: 0.75 },
          ],
        },
        {
          complementCategoryId: 'cat-c',
          candidates: [{ productId: 'c1', score: 0.6 }],
        },
      ],
    });

    // Round 1: a1, b1 (skips duplicate a1), c1; Round 2: a2, b2 (a3 excluded by maxPerCategory=2)
    assert.deepEqual(
      picked.map((p) => p.productId),
      ['a1', 'b1', 'c1', 'a2', 'b2'],
    );
  });

  it('sortRelationsForReading places manual first by position ASC, then auto by score DESC', () => {
    const sorted = sortRelationsForReading([
      { relatedProductId: 'auto-low', source: 'auto', position: 0, score: 0.55 },
      { relatedProductId: 'manual-2', source: 'manual', position: 2, score: null },
      { relatedProductId: 'auto-high', source: 'auto', position: 1, score: 0.88 },
      { relatedProductId: 'manual-0', source: 'manual', position: 0, score: null },
    ]);

    assert.deepEqual(
      sorted.map((r) => r.relatedProductId),
      ['manual-0', 'manual-2', 'auto-high', 'auto-low'],
    );
  });
});
