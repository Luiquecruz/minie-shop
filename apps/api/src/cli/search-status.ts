import 'reflect-metadata';
import { DatabaseService } from '../database/database.service.js';
import { CatalogService } from '../modules/catalog/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import { MeilisearchAdapter } from '../modules/search/index.js';

async function runStatus(): Promise<void> {
  const apiKey = process.env.MEILI_MASTER_KEY ?? process.env.MEILI_API_KEY;
  const databaseService = new DatabaseService();
  const storageAdapter = new S3StorageAdapter();
  const mediaService = new MediaService(databaseService, storageAdapter);
  const catalogService = new CatalogService(databaseService, mediaService);
  const adapter = new MeilisearchAdapter(apiKey ? { apiKey } : undefined);

  try {
    const [pgIds, indexIds] = await Promise.all([
      catalogService.listAllPublishedProductIds(),
      adapter.getDocumentIds(),
    ]);

    const pgSet = new Set(pgIds);
    const idxSet = new Set(indexIds);

    const missingInIndex = pgIds.filter((id) => !idxSet.has(id));
    const extraInIndex = indexIds.filter((id) => !pgSet.has(id));
    const inSync = missingInIndex.length === 0 && extraInIndex.length === 0;

    console.log(
      JSON.stringify(
        {
          inSync,
          postgresPublishedCount: pgIds.length,
          indexDocumentCount: indexIds.length,
          missingInIndexCount: missingInIndex.length,
          extraInIndexCount: extraInIndex.length,
          ...(missingInIndex.length > 0 ? { missingInIndex: missingInIndex.slice(0, 10) } : {}),
          ...(extraInIndex.length > 0 ? { extraInIndex: extraInIndex.slice(0, 10) } : {}),
        },
        null,
        2,
      ),
    );

    if (!inSync) {
      process.exitCode = 1;
    }
  } finally {
    await databaseService.onModuleDestroy();
  }
}

runStatus().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[search:status] Failed: ${message}`);
  process.exit(1);
});
