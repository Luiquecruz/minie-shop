import { Module } from '@nestjs/common';
import { MediaModule } from '../media/index.js';
import { CatalogService } from './catalog.service.js';
import { CategoriesController } from './categories.controller.js';
import { FavoritesController } from './favorites.controller.js';
import { ProductsController } from './products.controller.js';

@Module({
  imports: [MediaModule],
  controllers: [CategoriesController, ProductsController, FavoritesController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
