import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { OutboxService, type OutboxRecord } from '../platform/index.js';
import { CatalogService } from './catalog.service.js';

@Injectable()
export class CategoryChangedOutboxHandler {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
    @Inject(OutboxService)
    private readonly outboxService: OutboxService,
  ) {}

  async handle(event: OutboxRecord): Promise<void> {
    const categoryId =
      typeof event.payload.categoryId === 'string' ? event.payload.categoryId : event.aggregateId;

    const productIds = await this.catalogService.listProductIdsByCategorySubtree(categoryId);
    if (productIds.length === 0) {
      return;
    }

    await this.databaseService.db.transaction(async (tx) => {
      await this.outboxService.enqueueBatch(
        tx,
        productIds.map((productId) => ({
          eventType: 'product.changed' as const,
          aggregateType: 'product' as const,
          aggregateId: productId,
          payload: { productId },
        })),
      );
    });
  }
}
