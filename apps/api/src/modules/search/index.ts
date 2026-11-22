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
export { MeilisearchAdapter, type MeilisearchAdapterConfig } from './meilisearch.adapter.js';
export {
  buildProductsIndexSettings,
  loadPortugueseSynonyms,
  type ProductsIndexSettings,
} from './meilisearch-settings.js';
