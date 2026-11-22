import 'reflect-metadata';
import { DatabaseService } from '../database/database.service.js';
import { CatalogService } from '../modules/catalog/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import {
  MeilisearchAdapter,
  type IndexableDocumentWithVectors,
} from '../modules/search/index.js';

async function runReindex(): Promise<void> {
  const masterKey = process.env.MEILI_MASTER_KEY ?? process.env.MEILI_API_KEY;
  if (!masterKey || masterKey.trim().length === 0) {
    throw new Error('MEILI_MASTER_KEY is required to run search:reindex');
  }

  const databaseService = new DatabaseService();
  const storageAdapter = new S3StorageAdapter();
  const mediaService = new MediaService(databaseService, storageAdapter);
  const catalogService = new CatalogService(databaseService, mediaService);
  const adapter = new MeilisearchAdapter({ apiKey: masterKey });

  const batchSize = Number(process.env.REINDEX_BATCH_SIZE ?? 100);
  const embedderDimsRaw = process.env.EMBEDDINGS_DIMENSIONS;
  const embedderDimensions =
    embedderDimsRaw && /^\d+$/.test(embedderDimsRaw) ? Number(embedderDimsRaw) : undefined;
  const embedderName = process.env.MEILI_EMBEDDER_NAME ?? 'semantic';

  async function* batchGenerator(): AsyncIterable<IndexableDocumentWithVectors[]> {
    let afterId: string | undefined;
    while (true) {
      const ids = await catalogService.listIndexableProductIdsBatch({ afterId, limit: batchSize });
      if (ids.length === 0) {
        break;
      }
      const [docs, embMap] = await Promise.all([
        catalogService.getIndexableProductsByIds(ids),
        catalogService.getProductEmbeddingsByIds(ids),
      ]);

      const enriched: IndexableDocumentWithVectors[] = docs.map((doc) => {
        const emb = embMap.get(doc.id);
        if (embedderDimensions) {
          return {
            ...doc,
            _vectors: {
              [embedderName]:
                emb && emb.embedding.length === embedderDimensions
                  ? {
                      embeddings: emb.embedding,
                      regenerate: false,
                    }
                  : null,
            },
          };
        }
        return doc;
      });

      yield enriched;
      afterId = ids[ids.length - 1];
      if (ids.length < batchSize) {
        break;
      }
    }
  }

  try {
    const result = await adapter.reindex(batchGenerator(), {
      embedderName,
      embedderDimensions,
    });
    console.log(
      `[search:reindex] Completed cleanly: ${JSON.stringify(result)}`,
    );
  } finally {
    await databaseService.onModuleDestroy();
  }
}

runReindex().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[search:reindex] Failed: ${message}`);
  process.exit(1);
});
