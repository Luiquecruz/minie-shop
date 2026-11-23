import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildProductsIndexSettings } from '../modules/search/index.js';

const SEARCH_KEY_UID = '11111111-1111-4111-8111-111111110001';
const WORKER_KEY_UID = '11111111-1111-4111-8111-111111110002';

interface MeiliTaskResponse {
  taskUid?: number;
  uid?: number;
  status?: string;
  error?: { message?: string; code?: string };
}

interface MeiliKeyResponse {
  uid: string;
  key: string;
  name: string | null;
  actions: string[];
  indexes: string[];
}

async function meiliFetch<T>(
  baseUrl: string,
  masterKey: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${masterKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = (text.length > 0 ? JSON.parse(text) : {}) as T;
  return { status: res.status, data };
}

async function waitForTask(
  baseUrl: string,
  masterKey: string,
  taskUid: number,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await meiliFetch<MeiliTaskResponse>(baseUrl, masterKey, `/tasks/${taskUid}`);
    if (data.status === 'succeeded') {
      return;
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(
        `Meilisearch task ${taskUid} ${data.status}: ${data.error?.message ?? 'unknown error'}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for Meilisearch task ${taskUid}`);
}

async function ensureScopedKey(
  baseUrl: string,
  masterKey: string,
  spec: {
    uid: string;
    name: string;
    description: string;
    actions: string[];
    indexes: string[];
  },
): Promise<string> {
  const existing = await meiliFetch<MeiliKeyResponse>(baseUrl, masterKey, `/keys/${spec.uid}`);
  if (existing.status === 200 && existing.data.key) {
    return existing.data.key;
  }

  const created = await meiliFetch<MeiliKeyResponse>(baseUrl, masterKey, '/keys', {
    method: 'POST',
    body: JSON.stringify({
      uid: spec.uid,
      name: spec.name,
      description: spec.description,
      actions: spec.actions,
      indexes: spec.indexes,
      expiresAt: null,
    }),
  });

  if (created.status !== 201 || !created.data.key) {
    throw new Error(
      `Failed to create Meilisearch key "${spec.name}" (status ${created.status}): ${JSON.stringify(created.data)}`,
    );
  }
  return created.data.key;
}

async function run(): Promise<void> {
  const baseUrl = (process.env.MEILI_HOST ?? 'http://localhost:7700').replace(/\/+$/, '');
  const masterKey = process.env.MEILI_MASTER_KEY;
  if (!masterKey || masterKey.trim().length === 0) {
    throw new Error('MEILI_MASTER_KEY is required to run search:init');
  }

  const indexUid = process.env.MEILI_INDEX_PRODUCTS ?? 'products';
  const keysDir = process.env.MEILI_KEYS_DIR;
  const embedderDimsRaw = process.env.EMBEDDINGS_DIMENSIONS;
  const embedderDimensions =
    embedderDimsRaw && /^\d+$/.test(embedderDimsRaw) ? Number(embedderDimsRaw) : undefined;
  const embedderName = process.env.MEILI_EMBEDDER_NAME ?? 'semantic';

  // 1. Ensure index exists with primaryKey='id'
  const indexCheck = await meiliFetch<Record<string, unknown>>(
    baseUrl,
    masterKey,
    `/indexes/${indexUid}`,
  );
  if (indexCheck.status === 404) {
    console.log(`[search:init] Creating index "${indexUid}" (primaryKey=id)...`);
    const created = await meiliFetch<MeiliTaskResponse>(baseUrl, masterKey, '/indexes', {
      method: 'POST',
      body: JSON.stringify({ uid: indexUid, primaryKey: 'id' }),
    });
    if (created.status !== 202 || created.data.taskUid === undefined) {
      throw new Error(`Failed to create index "${indexUid}": ${JSON.stringify(created.data)}`);
    }
    await waitForTask(baseUrl, masterKey, created.data.taskUid);
  } else if (indexCheck.status !== 200) {
    throw new Error(`Unexpected response checking index "${indexUid}": ${indexCheck.status}`);
  }

  // 2. Apply index settings (idempotent)
  const settings = buildProductsIndexSettings({
    embedderName,
    embedderDimensions,
  });

  console.log(`[search:init] Applying settings to index "${indexUid}"...`);
  const settingsRes = await meiliFetch<MeiliTaskResponse>(
    baseUrl,
    masterKey,
    `/indexes/${indexUid}/settings`,
    {
      method: 'PATCH',
      body: JSON.stringify(settings),
    },
  );
  if (settingsRes.status !== 202 || settingsRes.data.taskUid === undefined) {
    throw new Error(`Failed to update settings: ${JSON.stringify(settingsRes.data)}`);
  }
  await waitForTask(baseUrl, masterKey, settingsRes.data.taskUid);

  // 3. Ensure least-privilege API keys (search-only for api, write-on-products for worker)
  const searchKey = await ensureScopedKey(baseUrl, masterKey, {
    uid: SEARCH_KEY_UID,
    name: 'minieshop-api-search-only',
    description: 'Search-only key for API service on products index',
    actions: ['search'],
    indexes: [indexUid],
  });

  const workerKey = await ensureScopedKey(baseUrl, masterKey, {
    uid: WORKER_KEY_UID,
    name: 'minieshop-worker-products-write',
    description: 'Index write key for worker service on products index',
    actions: ['documents.add', 'documents.get', 'documents.delete', 'tasks.get', 'indexes.get'],
    indexes: [indexUid],
  });

  if (keysDir && keysDir.trim().length > 0) {
    await mkdir(keysDir, { recursive: true });
    await writeFile(join(keysDir, 'search.key'), `${searchKey}\n`, { mode: 0o644 });
    await writeFile(join(keysDir, 'worker.key'), `${workerKey}\n`, { mode: 0o644 });
    console.log(`[search:init] Scoped keys written to ${keysDir} (search.key, worker.key).`);
  }

  console.log(
    `[search:init] Completed cleanly for index "${indexUid}" (embedder=${embedderDimensions ? `${embedderName}:${embedderDimensions}` : 'disabled'}).`,
  );
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[search:init] Failed: ${message}`);
  process.exit(1);
});
