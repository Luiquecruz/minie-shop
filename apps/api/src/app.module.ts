import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { CatalogModule } from './modules/catalog/index.js';
import { MediaModule } from './modules/media/index.js';
import { PlatformModule } from './modules/platform/index.js';

@Module({
  imports: [DatabaseModule, PlatformModule, HealthModule, MediaModule, CatalogModule],
})
export class AppModule {}
