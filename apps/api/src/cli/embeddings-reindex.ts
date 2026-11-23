import 'reflect-metadata';
import { loadEnv } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { CatalogService } from '../modules/catalog/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import { OutboxService } from '../modules/platform/index.js';
import {
  DeterministicFakeEmbeddingProvider,
  EMBEDDING_TEMPLATE_VERSION,
  OllamaEmbeddingProvider,
  buildProductEmbeddingText,
  computeEmbeddingContentHash,
  type EmbeddingProvider,
} from '../modules/search/index.js';

async function runEmbeddingsReindex(): Promise<void> {
  const env = loadEnv();
  const batchSize = Number(process.env.EMBEDDINGS_BATCH_SIZE ?? 10);

  const databaseService = new DatabaseService();
  const storage = new S3StorageAdapter();
  const mediaService = new MediaService(databaseService, storage);
  const outboxService = new OutboxService(databaseService);
  const catalogService = new CatalogService(databaseService, mediaService, outboxService);

  const provider: EmbeddingProvider =
    env.EMBEDDINGS_PROVIDER === 'fake'
      ? new DeterministicFakeEmbeddingProvider({
          modelName: env.EMBEDDINGS_MODEL,
          dimensions: env.EMBEDDINGS_DIMENSIONS,
        })
      : new OllamaEmbeddingProvider({
          baseUrl: env.EMBEDDINGS_BASE_URL,
          modelName: env.EMBEDDINGS_MODEL,
          dimensions: env.EMBEDDINGS_DIMENSIONS,
          defaultTimeoutMs: 120_000,
        });

  let totalPublished = 0;
  let generated = 0;
  let skipped = 0;

  try {
    let afterId: string | undefined;
    while (true) {
      const ids = await catalogService.listIndexableProductIdsBatch({ afterId, limit: batchSize });
      if (ids.length === 0) {
        break;
      }

      totalPublished += ids.length;
      const [docs, existingMap] = await Promise.all([
        catalogService.getIndexableProductsByIds(ids),
        catalogService.getProductEmbeddingsByIds(ids),
      ]);

      const toEmbed: Array<{ productId: string; title: string; text: string; contentHash: string }> =
        [];

      for (const doc of docs) {
        const text = buildProductEmbeddingText(doc);
        const contentHash = computeEmbeddingContentHash({
          model: provider.modelName,
          templateVersion: EMBEDDING_TEMPLATE_VERSION,
          text,
        });

        const existing = existingMap.get(doc.id);
        if (
          existing &&
          existing.model === provider.modelName &&
          existing.contentHash === contentHash
        ) {
          skipped += 1;
          continue;
        }

        toEmbed.push({ productId: doc.id, title: doc.name, text, contentHash });
      }

      if (toEmbed.length > 0) {
        const vectors = await provider.embedDocuments(
          toEmbed.map((item) => ({ title: item.title, text: item.text })),
          { timeoutMs: 120_000 },
        );

        for (let i = 0; i < toEmbed.length; i++) {
          const item = toEmbed[i]!;
          const vec = vectors[i]!;
          await catalogService.upsertProductEmbedding({
            productId: item.productId,
            embedding: vec,
            model: provider.modelName,
            contentHash: item.contentHash,
          });
        }

        await databaseService.db.transaction(async (tx) => {
          await outboxService.enqueueBatch(
            tx,
            toEmbed.map((item) => ({
              eventType: 'product.changed' as const,
              aggregateType: 'product' as const,
              aggregateId: item.productId,
              payload: { productId: item.productId },
              consumers: ['search-index'],
            })),
          );
        });

        generated += toEmbed.length;
      }

      console.log(
        `[embeddings:reindex] Progress: processed=${totalPublished} generated=${generated} skipped=${skipped}`,
      );

      afterId = ids[ids.length - 1];
      if (ids.length < batchSize) {
        break;
      }
    }

    console.log(
      `[embeddings:reindex] Completed: ${JSON.stringify({ model: provider.modelName, dimensions: provider.dimensions, totalPublished, generated, skipped })}`,
    );
  } finally {
    await databaseService.onModuleDestroy();
  }
}

runEmbeddingsReindex().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[embeddings:reindex] Failed: ${message}`);
  process.exit(1);
});
