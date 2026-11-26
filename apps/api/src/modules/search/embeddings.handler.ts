import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { CatalogService } from '../catalog/index.js';
import { OutboxService, type OutboxRecord } from '../platform/index.js';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './embedding.port.js';
import {
  EMBEDDING_TEMPLATE_VERSION,
  buildProductEmbeddingText,
  computeEmbeddingContentHash,
} from './embedding-text.js';

@Injectable()
export class EmbeddingsOutboxHandler {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
    @Inject(OutboxService)
    private readonly outboxService: OutboxService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async handle(event: OutboxRecord): Promise<{ skipped: boolean; deleted?: boolean }> {
    const productId =
      typeof event.payload.productId === 'string' ? event.payload.productId : event.aggregateId;

    const doc = await this.catalogService.getIndexableProductById(productId);
    if (!doc) {
      await this.catalogService.deleteProductEmbedding(productId);
      return { skipped: false, deleted: true };
    }

    const text = buildProductEmbeddingText(doc);
    const contentHash = computeEmbeddingContentHash({
      model: this.embeddingProvider.modelName,
      templateVersion: EMBEDDING_TEMPLATE_VERSION,
      text,
    });

    const existing = await this.catalogService.getProductEmbeddingMeta(productId);
    if (
      existing &&
      existing.model === this.embeddingProvider.modelName &&
      existing.contentHash === contentHash
    ) {
      return { skipped: true };
    }

    const [embedding] = await this.embeddingProvider.embedDocuments([
      { title: doc.name, text },
    ]);
    if (!embedding) {
      throw new Error(`Embedding provider returned empty vector for product "${productId}"`);
    }

    // Persist embedding and enqueue downstream notification atomically so a crash
    // can never leave a freshly written contentHash without a matching outbox event.
    await this.databaseService.db.transaction(async (tx) => {
      await this.catalogService.upsertProductEmbedding(
        {
          productId,
          embedding,
          model: this.embeddingProvider.modelName,
          contentHash,
        },
        tx,
      );

      await this.outboxService.enqueue(tx, {
        eventType: 'product.embedding_updated',
        aggregateType: 'product',
        aggregateId: productId,
        payload: { productId },
      });
    });

    return { skipped: false };
  }
}
