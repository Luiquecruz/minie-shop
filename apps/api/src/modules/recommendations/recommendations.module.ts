import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { CatalogModule } from '../catalog/index.js';
import { PlatformModule } from '../platform/index.js';
import { RecommendationsOutboxHandler } from './recommendations.handler.js';
import { RelationsService } from './relations.service.js';

@Module({
  imports: [DatabaseModule, PlatformModule, CatalogModule],
  providers: [RelationsService, RecommendationsOutboxHandler],
  exports: [RelationsService, RecommendationsOutboxHandler],
})
export class RecommendationsModule {}
