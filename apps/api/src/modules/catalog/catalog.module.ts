import { Module } from '@nestjs/common';
import { MediaModule } from '../media/index.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [MediaModule],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
