import { Inject, Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/index.js';
import type { OutboxRecord } from '../platform/index.js';
import { SEARCH_PORT, type SearchPort } from './search.port.js';

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
    if (doc) {
      await this.searchPort.upsertDocuments([doc], { waitForTask: true, timeoutMs: 15_000 });
    } else {
      await this.searchPort.deleteDocuments([productId], { waitForTask: true, timeoutMs: 15_000 });
    }
  }
}
