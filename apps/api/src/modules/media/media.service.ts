import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { ImageVariantDTO } from '@minieshop/contracts';
import sharp, { type Metadata } from 'sharp';
import { DatabaseService } from '../../database/database.service.js';
import { mediaAssets, type MediaVariantsMap } from '../../database/schema/media.js';
import { MediaValidationError } from './media.errors.js';
import { PUBLIC_IMMUTABLE_CACHE_CONTROL, S3StorageAdapter } from './s3-storage.adapter.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const FORMAT_TO_MIME_AND_EXT: Record<string, { mime: string; ext: string }> = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
  avif: { mime: 'image/avif', ext: 'avif' },
};

const VARIANT_SPECS = [
  { name: 'thumb', width: 200, quality: 80 },
  { name: 'card', width: 600, quality: 82 },
  { name: 'detail', width: 1200, quality: 85 },
] as const;

export interface RegisterMediaInput {
  productId: string;
  buffer: Buffer;
}

export interface RegisterMediaResult {
  assetId: string;
  storageKey: string;
  checksumSha256: string;
  variants: MediaVariantsMap;
  placeholderBase64: string | null;
  deduplicated: boolean;
  publicUrl: string;
}

export interface ReadyMediaAsset {
  id: string;
  width: number;
  height: number;
  placeholder: string;
  variants: ImageVariantDTO[];
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(S3StorageAdapter)
    private readonly storage: S3StorageAdapter,
  ) {}

  getModuleName(): string {
    return 'media';
  }

  async getReadyAssetsByIds(assetIds: string[]): Promise<Map<string, ReadyMediaAsset>> {
    const uniqueIds = Array.from(new Set(assetIds));
    const result = new Map<string, ReadyMediaAsset>();
    if (uniqueIds.length === 0) {
      return result;
    }

    const rows = await this.databaseService.db
      .select({
        id: mediaAssets.id,
        width: mediaAssets.width,
        height: mediaAssets.height,
        placeholderBase64: mediaAssets.placeholderBase64,
        variants: mediaAssets.variants,
      })
      .from(mediaAssets)
      .where(and(inArray(mediaAssets.id, uniqueIds), eq(mediaAssets.status, 'ready')));

    for (const row of rows) {
      const variants: ImageVariantDTO[] = [];
      const variantsMap = row.variants ?? {};

      for (const spec of VARIANT_SPECS) {
        const variant = variantsMap[spec.name];
        if (!variant) {
          continue;
        }
        variants.push({
          name: spec.name,
          url: this.storage.buildPublicUrl(variant.key),
          width: variant.width,
          height: variant.height,
        });
      }

      variants.sort((a, b) => a.width - b.width);

      const largestVariant = variants[variants.length - 1];
      result.set(row.id, {
        id: row.id,
        width: row.width ?? largestVariant?.width ?? 0,
        height: row.height ?? largestVariant?.height ?? 0,
        placeholder: row.placeholderBase64 ?? '',
        variants,
      });
    }

    return result;
  }

  async register(input: RegisterMediaInput): Promise<RegisterMediaResult> {
    if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
      throw new MediaValidationError('INVALID_FILE', 'File buffer is empty or invalid.');
    }

    if (input.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new MediaValidationError(
        'FILE_TOO_LARGE',
        `File size ${input.buffer.length} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes.`,
      );
    }

    let metadata: Metadata;
    try {
      metadata = await sharp(input.buffer).metadata();
    } catch {
      throw new MediaValidationError('INVALID_FILE', 'File could not be decoded as a valid image.');
    }

    const formatInfo = metadata.format ? FORMAT_TO_MIME_AND_EXT[metadata.format] : undefined;
    if (!formatInfo) {
      throw new MediaValidationError(
        'UNSUPPORTED_MIME_TYPE',
        `Unsupported image format: ${metadata.format ?? 'unknown'}. Allowed: jpeg, png, webp, avif.`,
      );
    }

    const checksumSha256 = createHash('sha256').update(input.buffer).digest('hex');

    const existing = await this.databaseService.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.checksumSha256, checksumSha256))
      .limit(1);

    const existingAsset = existing[0];
    if (existingAsset && existingAsset.status === 'ready') {
      return {
        assetId: existingAsset.id,
        storageKey: existingAsset.storageKey,
        checksumSha256: existingAsset.checksumSha256,
        variants: existingAsset.variants,
        placeholderBase64: existingAsset.placeholderBase64,
        deduplicated: true,
        publicUrl: this.storage.buildPublicUrl(existingAsset.storageKey),
      };
    }

    const assetUuid = randomUUID();
    const basePrefix = `products/${input.productId}/${assetUuid}`;
    const originalKey = `${basePrefix}/original.${formatInfo.ext}`;

    const [inserted] = await this.databaseService.db
      .insert(mediaAssets)
      .values({
        storageKey: originalKey,
        bucket: this.storage.publicBucket,
        mimeType: formatInfo.mime,
        sizeBytes: input.buffer.length,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        checksumSha256,
        status: 'pending',
        variants: {},
      })
      .returning();

    if (!inserted) {
      throw new MediaValidationError('UPLOAD_FAILED', 'Failed to create pending media_assets row.');
    }

    try {
      await this.storage.putObject({
        bucket: this.storage.publicBucket,
        key: originalKey,
        body: input.buffer,
        contentType: formatInfo.mime,
        cacheControl: PUBLIC_IMMUTABLE_CACHE_CONTROL,
      });

      const variants: MediaVariantsMap = {};
      for (const spec of VARIANT_SPECS) {
        const { data, info } = await sharp(input.buffer)
          .rotate()
          .resize({ width: spec.width, withoutEnlargement: true })
          .webp({ quality: spec.quality })
          .toBuffer({ resolveWithObject: true });

        const variantKey = `${basePrefix}/${spec.name}.webp`;
        await this.storage.putObject({
          bucket: this.storage.publicBucket,
          key: variantKey,
          body: data,
          contentType: 'image/webp',
          cacheControl: PUBLIC_IMMUTABLE_CACHE_CONTROL,
        });

        variants[spec.name] = {
          key: variantKey,
          width: info.width,
          height: info.height,
          sizeBytes: info.size,
          mimeType: 'image/webp',
        };
      }

      const placeholderBuffer = await sharp(input.buffer)
        .rotate()
        .resize({ width: 16, withoutEnlargement: true })
        .webp({ quality: 25 })
        .toBuffer();
      const placeholderBase64 = `data:image/webp;base64,${placeholderBuffer.toString('base64')}`;

      const [updated] = await this.databaseService.db
        .update(mediaAssets)
        .set({
          variants,
          placeholderBase64,
          status: 'ready',
          updatedAt: new Date(),
        })
        .where(eq(mediaAssets.id, inserted.id))
        .returning();

      if (!updated) {
        throw new Error('Failed to mark media_assets row as ready');
      }

      return {
        assetId: updated.id,
        storageKey: updated.storageKey,
        checksumSha256: updated.checksumSha256,
        variants: updated.variants,
        placeholderBase64: updated.placeholderBase64,
        deduplicated: false,
        publicUrl: this.storage.buildPublicUrl(updated.storageKey),
      };
    } catch (error) {
      await this.databaseService.db
        .update(mediaAssets)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(mediaAssets.id, inserted.id));

      throw new MediaValidationError(
        'UPLOAD_FAILED',
        `Media upload/processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
