import { Inject, Injectable } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { CatalogService } from '../catalog/index.js';
import type { OutboxRecord } from '../platform/index.js';
import {
  SEARCH_PORT,
  type IndexableDocumentWithVectors,
  type SearchPort,
} from './search.port.js';

@Injectable()
export class SearchIndexOutboxHandler {
  constructor(
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
    @Inject(SEARCH_PORT)
    private readonly searchPort: SearchPort,
  ) {}

  async handle(event: OutboxRecord): Promise<void> {
    const productId =
      typeof event.payload.productId === 'string' ? event.payload.productId : event.aggregateId;

    const doc = await this.catalogService.getIndexableProductById(productId);
    if (!doc) {
      await this.searchPort.deleteDocuments([productId], { waitForTask: true, timeoutMs: 15_000 });
      return;
    }

    const env = loadEnv();
    const embMap = await this.catalogService.getProductEmbeddingsByIds([productId]);
    const emb = embMap.get(productId);

    const payload: IndexableDocumentWithVectors = {
      ...doc,
      _vectors: {
        [env.MEILI_EMBEDDER_NAME]:
          emb &&
          emb.model === env.EMBEDDINGS_MODEL &&
          emb.embedding.length === env.EMBEDDINGS_DIMENSIONS
            ? {
                embeddings: emb.embedding,
                regenerate: false,
              }
            : null,
      },
    };

    await this.searchPort.upsertDocuments([payload], { waitForTask: true, timeoutMs: 15_000 });
  }
}
