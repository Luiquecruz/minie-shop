import { Module } from '@nestjs/common';
import { MediaModule } from '../media/index.js';
import { CatalogService } from './catalog.service.js';
import { CategoriesController } from './categories.controller.js';
import { CategoryChangedOutboxHandler } from './category-changed.handler.js';
import { FavoritesController } from './favorites.controller.js';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import { ProductsController } from './products.controller.js';

@Module({
  imports: [MediaModule],
  controllers: [CategoriesController, ProductsController, FavoritesController, PricingController],
  providers: [PricingService, CatalogService, CategoryChangedOutboxHandler],
  exports: [PricingService, CatalogService, CategoryChangedOutboxHandler],
})
export class CatalogModule {}
