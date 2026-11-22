import { Injectable, Optional } from '@nestjs/common';
import { loadEnv, resolveMeiliApiKey } from '../../config/env.js';
import { buildProductsIndexSettings } from './meilisearch-settings.js';
import type {
  IndexableDocumentWithVectors,
  ReindexResult,
  SearchHitResult,
  SearchPort,
  SearchQueryInput,
  SearchSuggestHit,
} from './search.port.js';

interface MeiliTaskResponse {
  taskUid?: number;
  status?: string;
  error?: { message?: string; code?: string };
}

interface MeiliSearchResponse {
  hits: Array<{
    id?: string;
    slug?: string;
    name?: string;
    categoryNames?: string;
  }>;
  estimatedTotalHits?: number;
}

interface MeiliDocumentsListResponse {
  results: Array<{ id: string }>;
  total: number;
  limit: number;
  offset: number;
}

export interface MeilisearchAdapterConfig {
  host?: string;
  apiKey?: string;
  indexUid?: string;
}

@Injectable()
export class MeilisearchAdapter implements SearchPort {
  private readonly host: string;
  private readonly apiKey: string;
  private readonly indexUid: string;

  constructor(@Optional() config?: MeilisearchAdapterConfig) {
    const env = loadEnv();
    this.host = (config?.host ?? env.MEILI_HOST).replace(/\/+$/, '');
    this.apiKey = config?.apiKey ?? resolveMeiliApiKey(env);
    this.indexUid = config?.indexUid ?? env.MEILI_INDEX_PRODUCTS;
  }

  private async request<T>(
    path: string,
    init?: RequestInit & { timeoutMs?: number },
  ): Promise<{ status: number; data: T }> {
    const timeoutMs = init?.timeoutMs ?? 5_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey.length > 0) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(`${this.host}${path}`, {
        ...init,
        headers: {
          ...headers,
          ...(init?.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });

      const text = await res.text();
      const data = (text.length > 0 ? JSON.parse(text) : {}) as T;
      return { status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  private async waitForTask(taskUid: number, timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const { status, data } = await this.request<MeiliTaskResponse>(`/tasks/${taskUid}`, {
        timeoutMs: Math.min(5_000, Math.max(500, deadline - Date.now())),
      });
      if (status !== 200) {
        throw new Error(`Meilisearch task status check failed (${status})`);
      }
      if (data.status === 'succeeded') {
        return;
      }
      if (data.status === 'failed' || data.status === 'canceled') {
        throw new Error(
          `Meilisearch task ${taskUid} ${data.status}: ${data.error?.message ?? 'unknown error'}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for Meilisearch task ${taskUid}`);
  }

  private buildFilterArray(input: Pick<SearchQueryInput, 'category' | 'minPrice' | 'maxPrice' | 'inStock'>): string[] {
    const filters: string[] = [];
    if (input.category) {
      const escaped = input.category.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      filters.push(`categoryPath = "${escaped}"`);
    }
    if (input.minPrice !== undefined) {
      filters.push(`price >= ${Math.trunc(input.minPrice)}`);
    }
    if (input.maxPrice !== undefined) {
      filters.push(`price <= ${Math.trunc(input.maxPrice)}`);
    }
    if (input.inStock !== undefined) {
      filters.push(`inStock = ${input.inStock ? 'true' : 'false'}`);
    }
    return filters;
  }

  async search(input: SearchQueryInput): Promise<SearchHitResult> {
    const filter = this.buildFilterArray(input);
    const body: Record<string, unknown> = {
      q: input.q,
      limit: input.limit,
      offset: input.offset,
      attributesToRetrieve: ['id'],
      ...(filter.length > 0 ? { filter } : {}),
    };

    if (input.vector && input.hybrid) {
      body.vector = input.vector;
      body.hybrid = {
        embedder: input.hybrid.embedder,
        semanticRatio: input.hybrid.semanticRatio,
      };
    }

    const { status, data } = await this.request<MeiliSearchResponse>(
      `/indexes/${this.indexUid}/search`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        timeoutMs: input.timeoutMs ?? 2_500,
      },
    );

    if (status !== 200) {
      throw new Error(`Meilisearch search failed with status ${status}: ${JSON.stringify(data)}`);
    }

    const ids = (data.hits ?? [])
      .map((hit) => hit.id)
      .filter((id): id is string => typeof id === 'string');

    return {
      ids,
      estimatedTotal: Number(data.estimatedTotalHits ?? ids.length),
    };
  }

  async suggest(q: string, limit: number, timeoutMs = 1_500): Promise<SearchSuggestHit[]> {
    const { status, data } = await this.request<MeiliSearchResponse>(
      `/indexes/${this.indexUid}/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          q,
          limit,
          attributesToRetrieve: ['slug', 'name', 'categoryNames'],
        }),
        timeoutMs,
      },
    );

    if (status !== 200) {
      throw new Error(`Meilisearch suggest failed with status ${status}`);
    }

    return (data.hits ?? [])
      .filter(
        (hit): hit is { slug: string; name: string; categoryNames?: string } =>
          typeof hit.slug === 'string' && typeof hit.name === 'string',
      )
      .map((hit) => {
        const parts = (hit.categoryNames ?? '')
          .split('>')
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          slug: hit.slug,
          name: hit.name,
          categoryName: parts[parts.length - 1] ?? '',
        };
      });
  }

  async upsertDocuments(
    docs: IndexableDocumentWithVectors[],
    options?: { waitForTask?: boolean; timeoutMs?: number },
  ): Promise<void> {
    if (docs.length === 0) {
      return;
    }

    const { status, data } = await this.request<MeiliTaskResponse>(
      `/indexes/${this.indexUid}/documents?primaryKey=id`,
      {
        method: 'POST',
        body: JSON.stringify(docs),
        timeoutMs: options?.timeoutMs ?? 15_000,
      },
    );

    if (status !== 202 || data.taskUid === undefined) {
      throw new Error(`Meilisearch upsert failed (${status}): ${JSON.stringify(data)}`);
    }

    if (options?.waitForTask !== false) {
      await this.waitForTask(data.taskUid, options?.timeoutMs ?? 30_000);
    }
  }

  async deleteDocuments(
    ids: string[],
    options?: { waitForTask?: boolean; timeoutMs?: number },
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const { status, data } = await this.request<MeiliTaskResponse>(
      `/indexes/${this.indexUid}/documents/delete-batch`,
      {
        method: 'POST',
        body: JSON.stringify(ids),
        timeoutMs: options?.timeoutMs ?? 15_000,
      },
    );

    if (status !== 202 || data.taskUid === undefined) {
      throw new Error(`Meilisearch delete failed (${status}): ${JSON.stringify(data)}`);
    }

    if (options?.waitForTask !== false) {
      await this.waitForTask(data.taskUid, options?.timeoutMs ?? 30_000);
    }
  }

  async reindex(
    batchIterator: AsyncIterable<IndexableDocumentWithVectors[]>,
    options?: { embedderName?: string; embedderDimensions?: number; timeoutMs?: number },
  ): Promise<ReindexResult> {
    const timeoutMs = options?.timeoutMs ?? 60_000;
    const tempIndexUid = `${this.indexUid}_reindex_${Date.now()}`;

    // 1. Create temporary index
    const createRes = await this.request<MeiliTaskResponse>('/indexes', {
      method: 'POST',
      body: JSON.stringify({ uid: tempIndexUid, primaryKey: 'id' }),
      timeoutMs,
    });
    if (createRes.status !== 202 || createRes.data.taskUid === undefined) {
      throw new Error(
        `Failed to create temp index "${tempIndexUid}": ${JSON.stringify(createRes.data)}`,
      );
    }
    await this.waitForTask(createRes.data.taskUid, timeoutMs);

    try {
      // 2. Apply identical settings to temporary index
      const settings = buildProductsIndexSettings({
        embedderName: options?.embedderName,
        embedderDimensions: options?.embedderDimensions,
      });
      const settingsRes = await this.request<MeiliTaskResponse>(
        `/indexes/${tempIndexUid}/settings`,
        {
          method: 'PATCH',
          body: JSON.stringify(settings),
          timeoutMs,
        },
      );
      if (settingsRes.status !== 202 || settingsRes.data.taskUid === undefined) {
        throw new Error(
          `Failed to apply settings to temp index: ${JSON.stringify(settingsRes.data)}`,
        );
      }
      await this.waitForTask(settingsRes.data.taskUid, timeoutMs);

      // 3. Stream batches into temporary index
      let indexedCount = 0;
      for await (const batch of batchIterator) {
        if (batch.length === 0) {
          continue;
        }
        const addRes = await this.request<MeiliTaskResponse>(
          `/indexes/${tempIndexUid}/documents?primaryKey=id`,
          {
            method: 'POST',
            body: JSON.stringify(batch),
            timeoutMs,
          },
        );
        if (addRes.status !== 202 || addRes.data.taskUid === undefined) {
          throw new Error(`Failed to add batch to temp index: ${JSON.stringify(addRes.data)}`);
        }
        await this.waitForTask(addRes.data.taskUid, timeoutMs);
        indexedCount += batch.length;
      }

      // 4. Ensure target index exists before atomic swap
      const targetCheck = await this.request<Record<string, unknown>>(
        `/indexes/${this.indexUid}`,
        { timeoutMs },
      );
      if (targetCheck.status === 404) {
        const createTarget = await this.request<MeiliTaskResponse>('/indexes', {
          method: 'POST',
          body: JSON.stringify({ uid: this.indexUid, primaryKey: 'id' }),
          timeoutMs,
        });
        if (createTarget.status === 202 && createTarget.data.taskUid !== undefined) {
          await this.waitForTask(createTarget.data.taskUid, timeoutMs);
        }
      }

      // 5. Atomic swap
      const swapRes = await this.request<MeiliTaskResponse>('/swap-indexes', {
        method: 'POST',
        body: JSON.stringify([{ indexes: [this.indexUid, tempIndexUid] }]),
        timeoutMs,
      });
      if (swapRes.status !== 202 || swapRes.data.taskUid === undefined) {
        throw new Error(`Failed to swap indexes: ${JSON.stringify(swapRes.data)}`);
      }
      await this.waitForTask(swapRes.data.taskUid, timeoutMs);

      // 6. Delete swapped-out temporary index
      const deleteRes = await this.request<MeiliTaskResponse>(`/indexes/${tempIndexUid}`, {
        method: 'DELETE',
        timeoutMs,
      });
      if (deleteRes.status === 202 && deleteRes.data.taskUid !== undefined) {
        await this.waitForTask(deleteRes.data.taskUid, timeoutMs);
      }

      return {
        indexedCount,
        tempIndexUid,
        targetIndexUid: this.indexUid,
      };
    } catch (error) {
      // Best-effort cleanup of temp index on failure
      await this.request(`/indexes/${tempIndexUid}`, { method: 'DELETE', timeoutMs: 5_000 }).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async getDocumentIds(): Promise<string[]> {
    const ids: string[] = [];
    const limit = 1000;
    let offset = 0;

    while (true) {
      const { status, data } = await this.request<MeiliDocumentsListResponse>(
        `/indexes/${this.indexUid}/documents?fields=id&limit=${limit}&offset=${offset}`,
        { timeoutMs: 10_000 },
      );

      if (status === 404) {
        return [];
      }
      if (status !== 200) {
        throw new Error(`Failed to list Meilisearch documents (${status})`);
      }

      const batch = data.results ?? [];
      for (const doc of batch) {
        ids.push(doc.id);
      }

      if (batch.length < limit) {
        break;
      }
      offset += limit;
    }

    return ids;
  }

  async health(timeoutMs = 1_500): Promise<boolean> {
    try {
      const { status, data } = await this.request<{ status?: string }>('/health', { timeoutMs });
      return status === 200 && data.status === 'available';
    } catch {
      return false;
    }
  }
}
