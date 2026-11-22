import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { products } from '../database/schema/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';

interface ParsedArgs {
  productSlug: string;
  files: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  let productSlug = '';
  const files: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === '--product' || arg === '-p') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --product');
      }
      productSlug = next;
      i += 1;
    } else if (arg.startsWith('--product=')) {
      productSlug = arg.slice('--product='.length);
    } else if (arg === '--') {
      continue;
    } else {
      files.push(arg);
    }
  }

  if (!productSlug || files.length === 0) {
    throw new Error('Usage: pnpm media:add --product <slug> <file1> [file2 ...]');
  }

  return { productSlug, files };
}

async function run(): Promise<void> {
  const { productSlug, files } = parseArgs(process.argv.slice(2));
  const databaseService = new DatabaseService();
  const storageAdapter = new S3StorageAdapter();
  const mediaService = new MediaService(databaseService, storageAdapter);

  try {
    const [product] = await databaseService.db
      .select({ id: products.id, name: products.name, slug: products.slug })
      .from(products)
      .where(eq(products.slug, productSlug))
      .limit(1);

    if (!product) {
      throw new Error(`Product not found for slug "${productSlug}"`);
    }

    for (const filePath of files) {
      const absolutePath = resolve(process.cwd(), filePath);
      const buffer = await readFile(absolutePath);
      const result = await mediaService.register({
        productId: product.id,
        buffer,
        altText: product.name,
      });

      const status = result.deduplicated ? 'DEDUPLICATED' : 'UPLOADED';
      console.log(
        `[media:add] ${status} ${basename(filePath)} -> ${result.storageKey} (asset=${result.assetId}, variants=${Object.keys(result.variants).join(',')})`,
      );
    }
  } finally {
    await databaseService.onModuleDestroy();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[media:add] Error: ${message}`);
  process.exit(1);
});
