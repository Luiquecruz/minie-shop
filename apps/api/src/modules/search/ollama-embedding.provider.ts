import { Injectable, Optional } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import type { EmbeddingDocumentInput, EmbeddingProvider } from './embedding.port.js';
import {
  formatEmbeddingDocumentForModel,
  formatEmbeddingQueryForModel,
} from './embedding-text.js';

interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
}

export interface OllamaEmbeddingConfig {
  baseUrl?: string;
  modelName?: string;
  dimensions?: number;
  maxRetries?: number;
  defaultTimeoutMs?: number;
}

@Injectable()
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  public readonly modelName: string;
  public readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly defaultTimeoutMs: number;

  constructor(@Optional() config?: OllamaEmbeddingConfig) {
    const env = loadEnv();
    this.baseUrl = (config?.baseUrl ?? env.EMBEDDINGS_BASE_URL).replace(/\/+$/, '');
    this.modelName = config?.modelName ?? env.EMBEDDINGS_MODEL;
    this.dimensions = config?.dimensions ?? env.EMBEDDINGS_DIMENSIONS;
    this.maxRetries = config?.maxRetries ?? 2;
    this.defaultTimeoutMs = config?.defaultTimeoutMs ?? 30_000;
  }

  private async callEmbedApi(inputs: string[], timeoutMs: number): Promise<number[][]> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(`${this.baseUrl}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.modelName,
            input: inputs,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Ollama /api/embed failed (${res.status}): ${errText.slice(0, 300)}`);
        }

        const data = (await res.json()) as OllamaEmbedResponse;
        if (!Array.isArray(data.embeddings) || data.embeddings.length !== inputs.length) {
          throw new Error(
            `Ollama /api/embed returned ${data.embeddings?.length ?? 0} embeddings for ${inputs.length} inputs`,
          );
        }

        for (const vec of data.embeddings) {
          if (!Array.isArray(vec) || vec.length !== this.dimensions) {
            throw new Error(
              `Embedding dimension mismatch for model "${this.modelName}": expected ${this.dimensions}, got ${vec?.length ?? 0}`,
            );
          }
        }

        return data.embeddings;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async embedDocuments(
    items: EmbeddingDocumentInput[],
    options?: { timeoutMs?: number },
  ): Promise<number[][]> {
    if (items.length === 0) {
      return [];
    }
    const formatted = items.map((item) =>
      formatEmbeddingDocumentForModel(this.modelName, item.title, item.text),
    );
    return this.callEmbedApi(formatted, options?.timeoutMs ?? this.defaultTimeoutMs);
  }

  async embedQuery(query: string, options?: { timeoutMs?: number }): Promise<number[]> {
    const formatted = formatEmbeddingQueryForModel(this.modelName, query);
    const [vector] = await this.callEmbedApi([formatted], options?.timeoutMs ?? 2_000);
    if (!vector) {
      throw new Error('Ollama returned empty embedding for query');
    }
    return vector;
  }
}
