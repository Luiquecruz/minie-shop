import 'reflect-metadata';
import { createApp } from './app.factory.js';

async function bootstrap(): Promise<void> {
  const { app, env, logger } = await createApp();
  await app.listen(env.PORT, env.HOST);
  logger.info({ port: env.PORT, host: env.HOST }, 'API server listening');
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[boot] Failed to start API:\n${message}`);
  process.exit(1);
});
