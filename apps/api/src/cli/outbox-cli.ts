import 'reflect-metadata';
import { DatabaseService } from '../database/database.service.js';
import { OutboxService } from '../modules/platform/index.js';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const databaseService = new DatabaseService();
  const outboxService = new OutboxService(databaseService);

  try {
    if (command === 'stats') {
      const stats = await outboxService.getStats();
      console.log(JSON.stringify({ stats }, null, 2));
      return;
    }

    if (command === 'requeue') {
      const target = args[0];
      if (!target) {
        throw new Error('Usage: pnpm outbox:requeue <event-id|--dead>');
      }
      const count =
        target === '--dead'
          ? await outboxService.requeue({ dead: true })
          : await outboxService.requeue({ id: target });
      console.log(JSON.stringify({ requeued: count }));
      return;
    }

    if (command === 'wait-drain') {
      const timeoutArg = args.find((arg) => arg.startsWith('--timeout='));
      const timeoutMs = timeoutArg ? Number(timeoutArg.split('=')[1]) : 60_000;
      const consumersArg = args.find((arg) => arg.startsWith('--consumers='));
      const consumers = consumersArg
        ? consumersArg
            .split('=')[1]!
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      await outboxService.waitDrain({ timeoutMs, consumers });
      console.log(JSON.stringify({ drained: true }));
      return;
    }

    throw new Error(`Unknown outbox command "${command ?? ''}". Use: stats | requeue | wait-drain`);
  } finally {
    await databaseService.onModuleDestroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[outbox] Error: ${message}`);
  process.exit(1);
});
