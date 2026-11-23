import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { CatalogService } from '../modules/catalog/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import {
  MeilisearchAdapter,
  OllamaEmbeddingProvider,
  type IndexableDocumentWithVectors,
} from '../modules/search/index.js';

interface EvalQueryCase {
  id: string;
  type: string;
  query: string;
  expectedSlugs: string[];
}

interface ConfigMetrics {
  config: string;
  recallAt5: number;
  recallAt10: number;
  mrr: number;
  positiveZeroResultRate: number;
  noResultZeroHitRate: number;
  searchP50Ms: number;
  searchP95Ms: number;
  embedP50Ms: number;
  embedP95Ms: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return Number((sorted[idx] ?? 0).toFixed(2));
}

async function runEval(): Promise<void> {
  const env = loadEnv();
  const masterKey = process.env.MEILI_MASTER_KEY ?? env.MEILI_MASTER_KEY ?? env.MEILI_API_KEY;
  if (!masterKey) {
    throw new Error('MEILI_MASTER_KEY is required for search:eval');
  }

  const rawQueries = await readFile(
    resolve(process.cwd(), 'seed/search-eval-queries.json'),
    'utf8',
  );
  const cases = JSON.parse(rawQueries) as EvalQueryCase[];
  const positiveCases = cases.filter((c) => c.expectedSlugs.length > 0);
  const negativeCases = cases.filter((c) => c.expectedSlugs.length === 0);

  const databaseService = new DatabaseService();
  const storage = new S3StorageAdapter();
  const mediaService = new MediaService(databaseService, storage);
  const catalogService = new CatalogService(databaseService, mediaService);
  const meili = new MeilisearchAdapter({ apiKey: masterKey });
  const ollama = new OllamaEmbeddingProvider({
    baseUrl: env.EMBEDDINGS_BASE_URL,
    modelName: env.EMBEDDINGS_MODEL,
    dimensions: env.EMBEDDINGS_DIMENSIONS,
    defaultTimeoutMs: 60_000,
    maxRetries: 1,
  });

  try {
    // Build slug map by product id for fast evaluation
    const allIds = await catalogService.listAllPublishedProductIds();
    const allDocs = await catalogService.getIndexableProductsByIds(allIds);
    const slugById = new Map(allDocs.map((d) => [d.id, d.slug]));

    // 1. Pre-compute query embeddings once (and measure pure embedding latency!)
    const queryVectors = new Map<string, number[]>();
    const embedLatenciesMs: number[] = [];
    // Warm up model once so cold load does not skew p50/p95 or time out
    await ollama.embedQuery('aquecimento', { timeoutMs: 120_000 });
    for (const tc of cases) {
      const t0 = performance.now();
      const vec = await ollama.embedQuery(tc.query, { timeoutMs: 120_000 });
      embedLatenciesMs.push(performance.now() - t0);
      queryVectors.set(tc.id, vec);
    }

    const configs: Array<{
      name: string;
      run: (tc: EvalQueryCase) => Promise<string[]>;
      usesEmbedding: boolean;
    }> = [
      {
        name: 'postgres_fts',
        usesEmbedding: false,
        run: async (tc) => {
          const res = await catalogService.searchProductsPostgresFallback({
            q: tc.query,
            limit: 10,
            offset: 0,
          });
          return res.items.map((item) => item.slug);
        },
      },
      {
        name: 'meili_keyword',
        usesEmbedding: false,
        run: async (tc) => {
          const res = await meili.search({ q: tc.query, limit: 10, offset: 0, timeoutMs: 10_000 });
          return res.ids.map((id) => slugById.get(id)).filter((s): s is string => Boolean(s));
        },
      },
      ...[0.3, 0.5, 0.7].map((ratio) => ({
        name: `meili_hybrid_${ratio}`,
        usesEmbedding: true,
        run: async (tc: EvalQueryCase) => {
          const res = await meili.search({
            q: tc.query,
            limit: 10,
            offset: 0,
            vector: queryVectors.get(tc.id),
            hybrid: { embedder: env.MEILI_EMBEDDER_NAME, semanticRatio: ratio },
            timeoutMs: 10_000,
          });
          return res.ids.map((id) => slugById.get(id)).filter((s): s is string => Boolean(s));
        },
      })),
    ];

    const results: ConfigMetrics[] = [];

    for (const cfg of configs) {
      let r5 = 0;
      let r10 = 0;
      let mrrSum = 0;
      let posZero = 0;
      let negZero = 0;
      const searchLatenciesMs: number[] = [];

      // Run 3 repetitions per query for stable p50/p95 latency
      for (const tc of cases) {
        let slugs: string[] = [];
        for (let rep = 0; rep < 3; rep++) {
          const t0 = performance.now();
          slugs = await cfg.run(tc);
          searchLatenciesMs.push(performance.now() - t0);
        }

        if (tc.expectedSlugs.length > 0) {
          if (slugs.length === 0) posZero++;
          const top5 = slugs.slice(0, 5);
          const top10 = slugs.slice(0, 10);
          if (tc.expectedSlugs.some((s) => top5.includes(s))) r5++;
          if (tc.expectedSlugs.some((s) => top10.includes(s))) r10++;
          const firstIdx = slugs.findIndex((s) => tc.expectedSlugs.includes(s));
          if (firstIdx >= 0) {
            mrrSum += 1 / (firstIdx + 1);
          }
        } else {
          if (slugs.length === 0) negZero++;
        }
      }

      results.push({
        config: cfg.name,
        recallAt5: Number((r5 / positiveCases.length).toFixed(3)),
        recallAt10: Number((r10 / positiveCases.length).toFixed(3)),
        mrr: Number((mrrSum / positiveCases.length).toFixed(3)),
        positiveZeroResultRate: Number((posZero / positiveCases.length).toFixed(3)),
        noResultZeroHitRate: Number((negZero / negativeCases.length).toFixed(3)),
        searchP50Ms: percentile(searchLatenciesMs, 0.5),
        searchP95Ms: percentile(searchLatenciesMs, 0.95),
        embedP50Ms: cfg.usesEmbedding ? percentile(embedLatenciesMs, 0.5) : 0,
        embedP95Ms: cfg.usesEmbedding ? percentile(embedLatenciesMs, 0.95) : 0,
      });
    }

    // 2. Verify reindex idempotency (2 runs -> identical document count)
    const embMap = await catalogService.getProductEmbeddingsByIds(allIds);
    const makeIterator = (): AsyncIterable<IndexableDocumentWithVectors[]> => ({
      async *[Symbol.asyncIterator]() {
        yield allDocs.map((doc) => {
          const emb = embMap.get(doc.id);
          return {
            ...doc,
            _vectors: {
              [env.MEILI_EMBEDDER_NAME]:
                emb && emb.embedding.length === env.EMBEDDINGS_DIMENSIONS
                  ? { embeddings: emb.embedding, regenerate: false as const }
                  : null,
            },
          };
        });
      },
    });

    const run1 = await meili.reindex(makeIterator(), {
      embedderName: env.MEILI_EMBEDDER_NAME,
      embedderDimensions: env.EMBEDDINGS_DIMENSIONS,
    });
    const run2 = await meili.reindex(makeIterator(), {
      embedderName: env.MEILI_EMBEDDER_NAME,
      embedderDimensions: env.EMBEDDINGS_DIMENSIONS,
    });
    const finalIndexIds = await meili.getDocumentIds();

    console.log(
      JSON.stringify(
        {
          dataset: {
            totalQueries: cases.length,
            positiveQueries: positiveCases.length,
            negativeQueries: negativeCases.length,
            model: env.EMBEDDINGS_MODEL,
            dimensions: env.EMBEDDINGS_DIMENSIONS,
          },
          metrics: results,
          reindexIdempotency: {
            run1Count: run1.indexedCount,
            run2Count: run2.indexedCount,
            finalIndexCount: finalIndexIds.length,
            idempotent:
              run1.indexedCount === allIds.length &&
              run2.indexedCount === allIds.length &&
              finalIndexIds.length === allIds.length,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await databaseService.onModuleDestroy();
  }
}

runEval().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[search:eval] Failed: ${message}`);
  process.exit(1);
});
