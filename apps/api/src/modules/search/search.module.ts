import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/index.js';
import { MeilisearchAdapter } from './meilisearch.adapter.js';
import { SEARCH_PORT } from './search.port.js';

@Module({
  imports: [CatalogModule],
  providers: [
    MeilisearchAdapter,
    {
      provide: SEARCH_PORT,
      useExisting: MeilisearchAdapter,
    },
  ],
  exports: [SEARCH_PORT, MeilisearchAdapter],
})
export class SearchModule {}
