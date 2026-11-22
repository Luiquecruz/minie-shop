export type OutboxStatus = 'pending' | 'processed' | 'dead';

export type OutboxConsumer =
  | 'search-index'
  | 'embeddings'
  | 'catalog-category-fanout'
  | 'noop';

export interface OutboxEventMap {
  'product.changed': {
    aggregateType: 'product';
    aggregateId: string;
    payload: { productId: string };
  };
  'category.changed': {
    aggregateType: 'category';
    aggregateId: string;
    payload: { categoryId: string };
  };
  'outbox.ping': {
    aggregateType: 'system';
    aggregateId: string;
    payload: { id: string };
  };
}

export type OutboxEventType = keyof OutboxEventMap;

export type OutboxEventInput<T extends OutboxEventType = OutboxEventType> = {
  eventType: T;
  aggregateType: OutboxEventMap[T]['aggregateType'];
  aggregateId: string;
  payload: OutboxEventMap[T]['payload'];
  consumers?: OutboxConsumer[];
};

export const OUTBOX_SUBSCRIPTIONS: Record<OutboxEventType, readonly OutboxConsumer[]> = {
  'product.changed': ['search-index', 'embeddings'],
  'category.changed': ['catalog-category-fanout'],
  'outbox.ping': ['noop'],
};

export interface OutboxRecord {
  id: string;
  eventType: string;
  consumer: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  availableAt: Date;
  attempts: number;
  lastError: string | null;
  lockedUntil: Date | null;
  processedAt: Date | null;
  status: OutboxStatus;
}
