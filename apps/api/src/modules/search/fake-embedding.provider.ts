import { createHash } from 'node:crypto';
import type { EmbeddingDocumentInput, EmbeddingProvider } from './embedding.port.js';

function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function deterministicVector(text: string, dimensions: number): number[] {
  const vec = new Float64Array(dimensions);
  const tokens = tokenize(text);
  const sourceTokens = tokens.length > 0 ? tokens : ['_empty_'];

  for (const token of sourceTokens) {
    const digest = createHash('sha256').update(token, 'utf8').digest();
    for (let i = 0; i < 4; i++) {
      const idx = digest.readUInt16BE(i * 2) % dimensions;
      const sign = (digest[8 + i]! & 1) === 0 ? 1 : -1;
      vec[idx] = (vec[idx] ?? 0) + sign;
    }
  }

  let normSq = 0;
  for (let i = 0; i < dimensions; i++) {
    normSq += vec[i]! * vec[i]!;
  }
  const norm = Math.sqrt(normSq) || 1;
  return Array.from(vec, (v) => Number((v / norm).toFixed(6)));
}

export class DeterministicFakeEmbeddingProvider implements EmbeddingProvider {
  public readonly modelName: string;
  public readonly dimensions: number;
  public callCount = 0;
  public shouldFail = false;

  constructor(options?: { modelName?: string; dimensions?: number }) {
    this.modelName = options?.modelName ?? 'fake-deterministic-v1';
    this.dimensions = options?.dimensions ?? 768;
  }

  async embedDocuments(items: EmbeddingDocumentInput[]): Promise<number[][]> {
    this.callCount += 1;
    if (this.shouldFail) {
      throw new Error('Simulated embedding provider failure');
    }
    return items.map((item) => deterministicVector(`${item.title} ${item.text}`, this.dimensions));
  }

  async embedQuery(query: string): Promise<number[]> {
    this.callCount += 1;
    if (this.shouldFail) {
      throw new Error('Simulated embedding provider failure');
    }
    return deterministicVector(query, this.dimensions);
  }
}
