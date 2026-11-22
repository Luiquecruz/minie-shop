import 'reflect-metadata';
import { loadEnv } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { CatalogService } from '../modules/catalog/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import {
  EMBEDDING_TEMPLATE_VERSION,
  buildProductEmbeddingText,
  computeEmbeddingContentHash,
} from '../modules/search/index.js';

async function runEmbeddingsStatus(): Promise<void> {
  const env = loadEnv();
  const databaseService = new DatabaseService();
  const storage = new S3StorageAdapter();
  const mediaService = new MediaService(databaseService, storage);
  const catalogService = new CatalogService(databaseService, mediaService);

  try {
    const ids = await catalogService.listAllPublishedProductIds();
    const [docs, existingMap] = await Promise.all([
      catalogService.getIndexableProductsByIds(ids),
      catalogService.getProductEmbeddingsByIds(ids),
    ]);

    let missing = 0;
    let staleByModel = 0;
    let staleByHash = 0;
    let upToDate = 0;

    for (const doc of docs) {
      const existing = existingMap.get(doc.id);
      if (!existing) {
        missing += 1;
        continue;
      }
      if (existing.model !== env.EMBEDDINGS_MODEL) {
        staleByModel += 1;
        continue;
      }
      const text = buildProductEmbeddingText(doc);
      const expectedHash = computeEmbeddingContentHash({
        model: env.EMBEDDINGS_MODEL,
        templateVersion: EMBEDDING_TEMPLATE_VERSION,
        text,
      });
      if (existing.contentHash !== expectedHash) {
        staleByHash += 1;
        continue;
      }
      upToDate += 1;
    }

    const complete = missing === 0 && staleByModel === 0 && staleByHash === 0;
    console.log(
      JSON.stringify(
        {
          complete,
          expectedModel: env.EMBEDDINGS_MODEL,
          templateVersion: EMBEDDING_TEMPLATE_VERSION,
          publishedProducts: docs.length,
          upToDate,
          missing,
          staleByModel,
          staleByHash,
        },
        null,
        2,
      ),
    );
  } finally {
    await databaseService.onModuleDestroy();
  }
}

runEmbeddingsStatus().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[embeddings:status] Failed: ${message}`);
  process.exit(1);
});
