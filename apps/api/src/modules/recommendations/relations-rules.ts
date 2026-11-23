export type RelationType = 'related' | 'upsell' | 'cross_sell';
export type RelationSource = 'manual' | 'auto';
export type RelationMethod = 'vector' | 'rule' | 'manual';

export interface RuleCandidate {
  productId: string;
  categoryId: string;
  effectivePriceCents: number;
  createdAt: Date;
}

export interface ScoredCandidate {
  productId: string;
  score: number;
}

export interface UpsellPriceBounds {
  minPriceCents: number;
  maxPriceCents: number;
}

export interface ReadableRelationRow {
  relatedProductId: string;
  source: RelationSource;
  position: number;
  score: number | null;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function formatScore(value: number): string {
  return clampScore(value).toFixed(5);
}

export function computeUpsellPriceBounds(
  basePriceCents: number,
  minRatio: number,
  maxRatio: number,
): UpsellPriceBounds {
  const safeBase = Math.max(0, basePriceCents);
  const effectiveMinRatio = Math.max(1, minRatio);
  const effectiveMaxRatio = Math.max(effectiveMinRatio, maxRatio);

  // Ensure strictly higher price than basePriceCents
  const minPriceCents = Math.max(safeBase + 1, Math.ceil(safeBase * effectiveMinRatio));
  const maxPriceCents = Math.max(minPriceCents, Math.floor(safeBase * effectiveMaxRatio));

  return { minPriceCents, maxPriceCents };
}

export function computeRuleRelatedScore(params: {
  sourcePriceCents: number;
  candidatePriceCents: number;
  candidateCreatedAt: Date;
  newestCreatedAtMs: number;
  oldestCreatedAtMs: number;
  tierBoost: number;
}): number {
  const base = Math.max(params.sourcePriceCents, 1);
  const priceDiffRatio = Math.abs(params.candidatePriceCents - params.sourcePriceCents) / base;
  const priceProximity = 1 / (1 + priceDiffRatio);

  const span = params.newestCreatedAtMs - params.oldestCreatedAtMs;
  const recency =
    span > 0
      ? (params.candidateCreatedAt.getTime() - params.oldestCreatedAtMs) / span
      : 1;

  // Weighted score in (0, 1], with tierBoost keeping same-leaf ahead of siblings
  const raw = params.tierBoost * (0.7 * priceProximity + 0.3 * recency);
  return clampScore(raw);
}

export function rankRuleRelated(params: {
  sourceCategoryId: string;
  sourcePriceCents: number;
  candidates: RuleCandidate[];
  limit: number;
}): ScoredCandidate[] {
  if (params.candidates.length === 0 || params.limit <= 0) {
    return [];
  }

  let newestMs = -Infinity;
  let oldestMs = Infinity;
  for (const c of params.candidates) {
    const t = c.createdAt.getTime();
    if (t > newestMs) newestMs = t;
    if (t < oldestMs) oldestMs = t;
  }

  const scored = params.candidates.map((c) => {
    const isSameLeaf = c.categoryId === params.sourceCategoryId;
    const score = computeRuleRelatedScore({
      sourcePriceCents: params.sourcePriceCents,
      candidatePriceCents: c.effectivePriceCents,
      candidateCreatedAt: c.createdAt,
      newestCreatedAtMs: newestMs,
      oldestCreatedAtMs: oldestMs,
      tierBoost: isSameLeaf ? 1.0 : 0.8,
    });
    return {
      productId: c.productId,
      isSameLeaf,
      score,
    };
  });

  scored.sort((a, b) => {
    if (a.isSameLeaf !== b.isSameLeaf) {
      return a.isSameLeaf ? -1 : 1;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.productId.localeCompare(b.productId);
  });

  return scored.slice(0, params.limit).map(({ productId, score }) => ({ productId, score }));
}

export function rankRuleUpsell(params: {
  sourcePriceCents: number;
  candidates: RuleCandidate[];
  bounds: UpsellPriceBounds;
  limit: number;
}): ScoredCandidate[] {
  if (params.candidates.length === 0 || params.limit <= 0) {
    return [];
  }

  const eligible = params.candidates.filter(
    (c) =>
      c.effectivePriceCents >= params.bounds.minPriceCents &&
      c.effectivePriceCents <= params.bounds.maxPriceCents,
  );

  if (eligible.length === 0) {
    return [];
  }

  let newestMs = -Infinity;
  let oldestMs = Infinity;
  for (const c of eligible) {
    const t = c.createdAt.getTime();
    if (t > newestMs) newestMs = t;
    if (t < oldestMs) oldestMs = t;
  }

  const idealPrice = Math.max(params.sourcePriceCents * 1.35, params.bounds.minPriceCents);

  const scored = eligible.map((c) => {
    const stepDistance = Math.abs(c.effectivePriceCents - idealPrice) / Math.max(idealPrice, 1);
    const stepScore = 1 / (1 + stepDistance);
    const span = newestMs - oldestMs;
    const recency = span > 0 ? (c.createdAt.getTime() - oldestMs) / span : 1;
    const score = clampScore(0.75 * stepScore + 0.25 * recency);
    return { productId: c.productId, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.productId.localeCompare(b.productId);
  });

  return scored.slice(0, params.limit);
}

export interface ComplementBucket {
  complementCategoryId: string;
  candidates: ScoredCandidate[];
}

export function selectDiverseCrossSell(params: {
  buckets: ComplementBucket[];
  maxPerCategory: number;
  limit: number;
}): ScoredCandidate[] {
  if (params.buckets.length === 0 || params.maxPerCategory <= 0 || params.limit <= 0) {
    return [];
  }

  const seen = new Set<string>();
  const picked: ScoredCandidate[] = [];
  const cursors = params.buckets.map(() => 0);
  const countsPerBucket = params.buckets.map(() => 0);

  let progressed = true;
  while (picked.length < params.limit && progressed) {
    progressed = false;

    for (let i = 0; i < params.buckets.length && picked.length < params.limit; i++) {
      if (countsPerBucket[i]! >= params.maxPerCategory) {
        continue;
      }

      const bucket = params.buckets[i]!;
      let cursor = cursors[i]!;

      while (cursor < bucket.candidates.length) {
        const candidate = bucket.candidates[cursor]!;
        cursor += 1;
        if (!seen.has(candidate.productId)) {
          seen.add(candidate.productId);
          picked.push({
            productId: candidate.productId,
            score: clampScore(candidate.score),
          });
          countsPerBucket[i] = countsPerBucket[i]! + 1;
          progressed = true;
          break;
        }
      }

      cursors[i] = cursor;
    }
  }

  return picked;
}

export function sortRelationsForReading<T extends ReadableRelationRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const aManual = a.source === 'manual' ? 0 : 1;
    const bManual = b.source === 'manual' ? 0 : 1;
    if (aManual !== bManual) {
      return aManual - bManual;
    }

    if (a.source === 'manual') {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return a.relatedProductId.localeCompare(b.relatedProductId);
    }

    const aScore = a.score ?? 0;
    const bScore = b.score ?? 0;
    if (bScore !== aScore) {
      return bScore - aScore;
    }
    if (a.position !== b.position) {
      return a.position - b.position;
    }
    return a.relatedProductId.localeCompare(b.relatedProductId);
  });
}
