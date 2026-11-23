export type OutboxStatus = 'pending' | 'processed' | 'dead';

export type OutboxConsumer =
  | 'search-index'
  | 'embeddings'
  | 'recommendations'
  | 'catalog-category-fanout'
  | 'mailer'
  | 'noop';

export type IdentityEmailKind =
  | 'verify_email'
  | 'reset_password'
  | 'already_registered'
  | 'password_changed';

export interface OutboxEventMap {
  'product.changed': {
    aggregateType: 'product';
    aggregateId: string;
    payload: { productId: string; cascade?: boolean };
  };
  'product.embedding_updated': {
    aggregateType: 'product';
    aggregateId: string;
    payload: { productId: string; cascade?: boolean };
  };
  'category.changed': {
    aggregateType: 'category';
    aggregateId: string;
    payload: { categoryId: string };
  };
  'identity.email_requested': {
    aggregateType: 'customer';
    aggregateId: string;
    payload: {
      kind: IdentityEmailKind;
      customerId: string;
      emailTokenId?: string;
    };
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
  'product.changed': ['search-index', 'embeddings', 'recommendations'],
  'product.embedding_updated': ['search-index', 'recommendations'],
  'category.changed': ['catalog-category-fanout'],
  'identity.email_requested': ['mailer'],
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
