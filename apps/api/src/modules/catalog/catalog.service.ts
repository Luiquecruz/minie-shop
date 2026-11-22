import { Inject, Injectable } from '@nestjs/common';
import { MediaService } from '../media/index.js';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(MediaService)
    private readonly mediaService: MediaService,
  ) {}

  getModuleSummary(): { module: string; mediaModule: string } {
    return {
      module: 'catalog',
      mediaModule: this.mediaService.getModuleName(),
    };
  }
}
