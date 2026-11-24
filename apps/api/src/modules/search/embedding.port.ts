export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export interface EmbeddingDocumentInput {
  title: string;
  text: string;
}

export interface EmbeddingProvider {
  readonly modelName: string;
  readonly dimensions: number;
  embedDocuments(
    items: EmbeddingDocumentInput[],
    options?: { timeoutMs?: number },
  ): Promise<number[][]>;
  embedQuery(
    query: string,
    options?: { timeoutMs?: number; maxRetries?: number; signal?: AbortSignal },
  ): Promise<number[]>;
}
