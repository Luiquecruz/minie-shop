import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { RelationsService, type RelationType } from '../modules/recommendations/index.js';

function parseFlag(args: string[], flag: string): string | undefined {
  const eqPrefix = `${flag}=`;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith(eqPrefix)) {
      return arg.slice(eqPrefix.length);
    }
    if (arg === flag && args[i + 1] !== undefined) {
      return args[i + 1];
    }
  }
  return undefined;
}

function parsePositionalArgs(args: string[]): string[] {
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      if (!arg.includes('=') && args[i + 1] !== undefined && !args[i + 1]!.startsWith('--')) {
        i += 1;
      }
      continue;
    }
    positional.push(arg);
  }
  return positional;
}

const VALID_TYPES = new Set<RelationType>(['related', 'upsell', 'cross_sell']);

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== 'add' && command !== 'remove') {
    throw new Error(
      'Usage: tsx src/cli/relations-curate.ts <add|remove> <productSlug> <relatedProductSlug> --type=<related|upsell|cross_sell> [--position=0]',
    );
  }

  const positional = parsePositionalArgs(rest);
  const [productSlug, relatedProductSlug] = positional;
  const typeRaw = parseFlag(rest, '--type') ?? 'related';
  const positionRaw = parseFlag(rest, '--position');

  if (!productSlug || !relatedProductSlug) {
    throw new Error('Both <productSlug> and <relatedProductSlug> are required.');
  }
  if (!VALID_TYPES.has(typeRaw as RelationType)) {
    throw new Error(`Invalid --type "${typeRaw}". Must be one of: related, upsell, cross_sell.`);
  }

  const type = typeRaw as RelationType;
  const position = positionRaw !== undefined ? Number(positionRaw) : 0;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const relationsService = app.get(RelationsService);
    if (command === 'add') {
      const saved = await relationsService.addManualRelation({
        productSlug,
        relatedProductSlug,
        type,
        position,
      });
      console.log(JSON.stringify({ action: 'added', ...saved }, null, 2));
    } else {
      const removed = await relationsService.removeManualRelation({
        productSlug,
        relatedProductSlug,
        type,
      });
      console.log(JSON.stringify({ action: 'removed', ...removed }, null, 2));
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[relations:curate] Failed: ${message}`);
  process.exit(1);
});
