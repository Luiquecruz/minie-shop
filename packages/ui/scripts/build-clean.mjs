import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(packageDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
