import { Module } from '@nestjs/common';
import { MediaModule } from '../media/index.js';
import { CatalogService } from './catalog.service.js';
import { CategoriesController } from './categories.controller.js';
import { CategoryChangedOutboxHandler } from './category-changed.handler.js';
import { FavoritesController } from './favorites.controller.js';
import { ProductsController } from './products.controller.js';

@Module({
  imports: [MediaModule],
  controllers: [CategoriesController, ProductsController, FavoritesController],
  providers: [CatalogService, CategoryChangedOutboxHandler],
  exports: [CatalogService, CategoryChangedOutboxHandler],
})
export class CatalogModule {}
