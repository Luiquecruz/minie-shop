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
    const status = await relationsService.getStatus();
    console.log(JSON.stringify(status, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[relations:status] Failed: ${message}`);
  process.exit(1);
});
