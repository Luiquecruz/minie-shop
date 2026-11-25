import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider.js';

describe('OllamaEmbeddingProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fails fast with a single attempt by default on embedQuery', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new Error('Ollama timeout');
    }) as typeof fetch;

    const provider = new OllamaEmbeddingProvider({
      baseUrl: 'http://embeddings.local:11434',
      modelName: 'embeddinggemma',
      dimensions: 4,
      maxRetries: 2,
    });

    await assert.rejects(
      () => provider.embedQuery('relogio branco', { timeoutMs: 1_000 }),
      /Ollama timeout/,
    );
    assert.equal(calls, 1);
  });

  it('aborts the underlying fetch immediately when external AbortSignal fires', async () => {
    let calls = 0;
    let observedSignal: AbortSignal | undefined;

    globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      observedSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    }) as typeof fetch;

    const provider = new OllamaEmbeddingProvider({
      baseUrl: 'http://embeddings.local:11434',
      modelName: 'embeddinggemma',
      dimensions: 4,
      maxRetries: 2,
    });

    const controller = new AbortController();
    const promise = provider.embedQuery('tenis vermelho', {
      timeoutMs: 5_000,
      signal: controller.signal,
    });

    controller.abort();

    await assert.rejects(
      () => promise,
      (error: unknown) => error instanceof Error && error.name === 'AbortError',
    );
    assert.equal(observedSignal?.aborted, true);
    assert.equal(calls, 1);
  });

  it('keeps retrying transient failures on embedDocuments for background indexing', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('Transient error 1');
      }
      return new Response(
        JSON.stringify({ model: 'embeddinggemma', embeddings: [[0.1, 0.2, 0.3, 0.4]] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const provider = new OllamaEmbeddingProvider({
      baseUrl: 'http://embeddings.local:11434',
      modelName: 'embeddinggemma',
      dimensions: 4,
      maxRetries: 2,
    });

    const vectors = await provider.embedDocuments([{ title: 'Relógio', text: 'Couro camel' }], {
      timeoutMs: 1_000,
    });

    assert.deepEqual(vectors, [[0.1, 0.2, 0.3, 0.4]]);
    assert.equal(calls, 2);
  });
});
