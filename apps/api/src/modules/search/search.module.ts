import { Module } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { CatalogModule } from '../catalog/index.js';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './embedding.port.js';
import { EmbeddingsOutboxHandler } from './embeddings.handler.js';
import { DeterministicFakeEmbeddingProvider } from './fake-embedding.provider.js';
import { MeilisearchAdapter } from './meilisearch.adapter.js';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider.js';
import { SearchController } from './search.controller.js';
import { SearchIndexOutboxHandler } from './search-index.handler.js';
import { SEARCH_PORT } from './search.port.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [SearchController],
  providers: [
    MeilisearchAdapter,
    {
      provide: SEARCH_PORT,
      useExisting: MeilisearchAdapter,
    },
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (): EmbeddingProvider => {
        const env = loadEnv();
        if (env.EMBEDDINGS_PROVIDER === 'fake') {
          return new DeterministicFakeEmbeddingProvider({
            modelName: env.EMBEDDINGS_MODEL,
            dimensions: env.EMBEDDINGS_DIMENSIONS,
          });
        }
        return new OllamaEmbeddingProvider({
          baseUrl: env.EMBEDDINGS_BASE_URL,
          modelName: env.EMBEDDINGS_MODEL,
          dimensions: env.EMBEDDINGS_DIMENSIONS,
        });
      },
    },
    SearchService,
    SearchIndexOutboxHandler,
    EmbeddingsOutboxHandler,
  ],
  exports: [
    SEARCH_PORT,
    EMBEDDING_PROVIDER,
    MeilisearchAdapter,
    SearchService,
    SearchIndexOutboxHandler,
    EmbeddingsOutboxHandler,
  ],
})
export class SearchModule {}
