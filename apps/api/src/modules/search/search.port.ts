import type { SearchIndexDocument } from '@minieshop/contracts';

export const SEARCH_PORT = Symbol('SEARCH_PORT');

export type IndexableDocumentWithVectors = SearchIndexDocument & {
  _vectors?: Record<string, { embeddings: number[]; regenerate: false } | null>;
};

export interface SearchQueryInput {
  q: string;
  limit: number;
  offset: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  vector?: number[];
  hybrid?: {
    embedder: string;
    semanticRatio: number;
  };
  timeoutMs?: number;
}

export interface SearchHitResult {
  ids: string[];
  estimatedTotal: number;
}

export interface SearchSuggestHit {
  slug: string;
  name: string;
  categoryName: string;
}

export interface ReindexResult {
  indexedCount: number;
  tempIndexUid: string;
  targetIndexUid: string;
}

export interface SearchPort {
  search(input: SearchQueryInput): Promise<SearchHitResult>;
  suggest(q: string, limit: number, timeoutMs?: number): Promise<SearchSuggestHit[]>;
  upsertDocuments(
    docs: IndexableDocumentWithVectors[],
    options?: { waitForTask?: boolean; timeoutMs?: number },
  ): Promise<void>;
  deleteDocuments(
    ids: string[],
    options?: { waitForTask?: boolean; timeoutMs?: number },
  ): Promise<void>;
  reindex(
    batchIterator: AsyncIterable<IndexableDocumentWithVectors[]>,
    options?: { embedderName?: string; embedderDimensions?: number; timeoutMs?: number },
  ): Promise<ReindexResult>;
  getDocumentIds(): Promise<string[]>;
  health(timeoutMs?: number): Promise<boolean>;
}
