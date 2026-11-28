import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcTokensDir = resolve(packageDir, 'src/tokens');
const distTokensDir = resolve(packageDir, 'dist/tokens');
const distEntry = resolve(packageDir, 'dist/index.js');

mkdirSync(distTokensDir, { recursive: true });

for (const cssFile of ['tokens.css', 'styles.css']) {
  copyFileSync(resolve(srcTokensDir, cssFile), resolve(distTokensDir, cssFile));
}

if (!existsSync(distEntry)) {
  throw new Error('Expected compiled entrypoint dist/index.js to exist after tsc build.');
}

const rootBundle = readFileSync(distEntry, 'utf8').trimStart();
if (rootBundle.startsWith('"use client"') || rootBundle.startsWith("'use client'")) {
  throw new Error(
    'RSC contract violation: dist/index.js must never emit a top-level "use client" directive.',
  );
}
