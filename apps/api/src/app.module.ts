import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { CatalogModule } from './modules/catalog/index.js';
import { MediaModule } from './modules/media/index.js';
import { PlatformModule } from './modules/platform/index.js';
import { RecommendationsModule } from './modules/recommendations/index.js';
import { SearchModule } from './modules/search/index.js';

@Module({
  imports: [
    DatabaseModule,
    PlatformModule,
    HealthModule,
    MediaModule,
    CatalogModule,
    SearchModule,
    RecommendationsModule,
  ],
})
export class AppModule {}
