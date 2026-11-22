export { SearchModule } from './search.module.js';
export {
  SEARCH_PORT,
  type IndexableDocumentWithVectors,
  type ReindexResult,
  type SearchHitResult,
  type SearchPort,
  type SearchQueryInput,
  type SearchSuggestHit,
} from './search.port.js';
export {
  EMBEDDING_PROVIDER,
  type EmbeddingDocumentInput,
  type EmbeddingProvider,
} from './embedding.port.js';
export {
  EMBEDDING_TEMPLATE_VERSION,
  buildProductEmbeddingText,
  computeEmbeddingContentHash,
  formatEmbeddingDocumentForModel,
  formatEmbeddingQueryForModel,
} from './embedding-text.js';
export { MeilisearchAdapter, type MeilisearchAdapterConfig } from './meilisearch.adapter.js';
export {
  OllamaEmbeddingProvider,
  type OllamaEmbeddingConfig,
} from './ollama-embedding.provider.js';
export { DeterministicFakeEmbeddingProvider } from './fake-embedding.provider.js';
export { SearchIndexOutboxHandler } from './search-index.handler.js';
export { EmbeddingsOutboxHandler } from './embeddings.handler.js';
export {
  buildProductsIndexSettings,
  loadPortugueseSynonyms,
  type ProductsIndexSettings,
} from './meilisearch-settings.js';
