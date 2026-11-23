import { Inject, Injectable } from '@nestjs/common';
import type { OutboxRecord } from '../platform/index.js';
import { RelationsService } from './relations.service.js';

@Injectable()
export class RecommendationsOutboxHandler {
  constructor(
    @Inject(RelationsService)
    private readonly relationsService: RelationsService,
  ) {}

  async handle(event: OutboxRecord): Promise<void> {
    const productId =
      typeof event.payload.productId === 'string' ? event.payload.productId : event.aggregateId;
    const cascade = event.payload.cascade !== false;

    await this.relationsService.recompute(productId, { cascade });
  }
}
