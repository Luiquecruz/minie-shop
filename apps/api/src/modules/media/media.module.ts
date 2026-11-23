import { Module } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { S3StorageAdapter } from './s3-storage.adapter.js';

@Module({
  providers: [S3StorageAdapter, MediaService],
  exports: [MediaService, S3StorageAdapter],
})
export class MediaModule {}
