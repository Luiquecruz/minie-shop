import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { RelationsService } from '../modules/recommendations/index.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const relationsService = app.get(RelationsService);
    const startedAt = Date.now();
    const result = await relationsService.rebuildAll({
      onProgress: ({ processed, total, productId }) => {
        if (processed % 5 === 0 || processed === total) {
          console.log(`[relations:rebuild] ${processed}/${total} processed (last=${productId})`);
        }
      },
    });
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[relations:rebuild] Completed: ${JSON.stringify({ ...result, elapsedMs })}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[relations:rebuild] Failed: ${message}`);
  process.exit(1);
});
