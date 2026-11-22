import { Injectable } from '@nestjs/common';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { loadEnv } from '../../config/env.js';

export interface PutObjectInput {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

export const PUBLIC_IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

@Injectable()
export class S3StorageAdapter {
  private readonly client: S3Client;
  public readonly publicBucket: string;
  public readonly privateBucket: string;
  public readonly publicEndpoint: string;

  constructor() {
    const env = loadEnv();
    this.publicBucket = env.S3_PUBLIC_BUCKET;
    this.privateBucket = env.S3_PRIVATE_BUCKET;
    this.publicEndpoint = env.S3_PUBLIC_ENDPOINT.replace(/\/+$/, '');
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async putObject(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
      }),
    );
  }

  async headObject(bucket: string, key: string): Promise<HeadObjectCommandOutput | null> {
    try {
      return await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      return null;
    }
  }

  buildPublicUrl(key: string): string {
    return `${this.publicEndpoint}/${this.publicBucket}/${key}`;
  }
}
