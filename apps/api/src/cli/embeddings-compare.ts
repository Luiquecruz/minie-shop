import 'reflect-metadata';
import { DatabaseService } from '../database/database.service.js';
import { CatalogService } from '../modules/catalog/index.js';
import { MediaService, S3StorageAdapter } from '../modules/media/index.js';
import {
  OllamaEmbeddingProvider,
  buildProductEmbeddingText,
} from '../modules/search/index.js';

interface EvalCase {
  query: string;
  expectedSlugs: string[];
  category: string;
}

const EVAL_QUERIES: EvalCase[] = [
  { query: 'fone para viajar de avião sem barulho', expectedSlugs: ['fone-de-ouvido-bluetooth-over-ear-pro', 'earbuds-tws-cancelamento-de-ruido'], category: 'intent' },
  { query: 'música na piscina ou praia', expectedSlugs: ['caixa-de-som-portatil-bluetooth-waterproof'], category: 'intent' },
  { query: 'trabalhar muitas horas sentado com conforto', expectedSlugs: ['cadeira-de-escritorio-ergonomica-mesh'], category: 'intent' },
  { query: 'melhorar postura do pescoço usando laptop', expectedSlugs: ['suporte-articulado-para-notebook-aluminio'], category: 'intent' },
  { query: 'manter água gelada na academia', expectedSlugs: ['garrafa-termica-inox-vacuum-750ml'], category: 'intent' },
  { query: 'fazer café especial em casa', expectedSlugs: ['cafeteira-prensa-francesa-inox-600ml', 'kit-xicaras-de-ceramica-artesanal-2-un'], category: 'intent' },
  { query: 'proteger os olhos da tela do computador à noite', expectedSlugs: ['oculos-de-grau-bloqueio-luz-azul'], category: 'intent' },
  { query: 'filmar paisagens do alto com qualidade profissional', expectedSlugs: ['drone-compacto-dobravel-4k-hdr'], category: 'intent' },
  { query: 'monitorar batimentos e corrida', expectedSlugs: ['smartwatch-fitness-active-series'], category: 'intent' },
  { query: 'roupa confortável para dias frios', expectedSlugs: ['moletom-hoodie-minimalista-com-capuz', 'jaqueta-jeans-trucker-vintage'], category: 'intent' },
  { query: 'calçado leve para maratona e treino', expectedSlugs: ['tenis-running-ultralight-performance'], category: 'intent' },
  { query: 'presente cheiroso para relaxar na sala', expectedSlugs: ['vela-aromatica-artesanal-soja-baunilha'], category: 'intent' },
  { query: 'levar notebook na chuva com segurança', expectedSlugs: ['mochila-urbana-impermeavel-antifurto'], category: 'intent' },
  { query: 'recarregar celular sem fio na mesa', expectedSlugs: ['carregador-sem-fio-inducao-15w'], category: 'intent' },
  { query: 'iluminação para estudar à noite na escrivaninha', expectedSlugs: ['luminaria-de-mesa-articulada-nordica'], category: 'intent' },
  { query: 'organizar cabos e canetas no home office', expectedSlugs: ['organizador-de-mesa-em-madeira-aluminio'], category: 'intent' },
  { query: 'digitar com precisão e resposta tátil', expectedSlugs: ['teclado-mecanico-rgb-switch-brown'], category: 'intent' },
  { query: 'bagagem compacta para viagem de fim de semana', expectedSlugs: ['bolsa-mala-de-viagem-duffle-weekend'], category: 'intent' },
  { query: 'gravar vídeos profissionais para YouTube', expectedSlugs: ['camera-mirrorless-4k-creator-kit'], category: 'intent' },
  { query: 'jogos em realidade virtual imersiva', expectedSlugs: ['oculos-de-realidade-virtual-imersivo'], category: 'intent' },
];

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function evaluateModel(
  modelName: string,
  dimensions: number,
  docs: Array<{ slug: string; title: string; text: string }>,
  baseUrl: string,
) {
  const provider = new OllamaEmbeddingProvider({
    baseUrl,
    modelName,
    dimensions,
    defaultTimeoutMs: 120_000,
    maxRetries: 1,
  });

  const docStart = Date.now();
  const docVectors = await provider.embedDocuments(
    docs.map((d) => ({ title: d.title, text: d.text })),
    { timeoutMs: 120_000 },
  );
  const docTotalMs = Date.now() - docStart;

  let recall3 = 0;
  let recall5 = 0;
  let mrrSum = 0;
  const queryLatencies: number[] = [];

  for (const tc of EVAL_QUERIES) {
    const qStart = Date.now();
    const qVec = await provider.embedQuery(tc.query, { timeoutMs: 60_000 });
    queryLatencies.push(Date.now() - qStart);

    const ranked = docs
      .map((doc, i) => ({
        slug: doc.slug,
        score: cosineSimilarity(qVec, docVectors[i]!),
      }))
      .sort((a, b) => b.score - a.score);

    const top3 = ranked.slice(0, 3).map((r) => r.slug);
    const top5 = ranked.slice(0, 5).map((r) => r.slug);

    if (tc.expectedSlugs.some((s) => top3.includes(s))) recall3++;
    if (tc.expectedSlugs.some((s) => top5.includes(s))) recall5++;

    const firstRankIdx = ranked.findIndex((r) => tc.expectedSlugs.includes(r.slug));
    if (firstRankIdx >= 0) {
      mrrSum += 1 / (firstRankIdx + 1);
    }
  }

  queryLatencies.sort((a, b) => a - b);
  const p50 = queryLatencies[Math.floor(queryLatencies.length * 0.5)] ?? 0;
  const p95 = queryLatencies[Math.floor(queryLatencies.length * 0.95)] ?? 0;

  return {
    model: modelName,
    dimensions,
    queries: EVAL_QUERIES.length,
    recallAt3: Number((recall3 / EVAL_QUERIES.length).toFixed(3)),
    recallAt5: Number((recall5 / EVAL_QUERIES.length).toFixed(3)),
    mrr: Number((mrrSum / EVAL_QUERIES.length).toFixed(3)),
    docBatchMs: docTotalMs,
    queryP50Ms: p50,
    queryP95Ms: p95,
  };
}

async function main(): Promise<void> {
  const baseUrl = process.env.EMBEDDINGS_BASE_URL ?? 'http://127.0.0.1:11434';
  const databaseService = new DatabaseService();
  const storage = new S3StorageAdapter();
  const mediaService = new MediaService(databaseService, storage);
  const catalogService = new CatalogService(databaseService, mediaService);

  try {
    const ids = await catalogService.listAllPublishedProductIds();
    const indexDocs = await catalogService.getIndexableProductsByIds(ids);
    const prepared = indexDocs.map((doc) => ({
      slug: doc.slug,
      title: doc.name,
      text: buildProductEmbeddingText(doc),
    }));

    const results = [];
    results.push(await evaluateModel('bge-m3', 1024, prepared, baseUrl));
    results.push(await evaluateModel('embeddinggemma', 768, prepared, baseUrl));
    results.push(await evaluateModel('embeddinggemma-2', 768, prepared, baseUrl));

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await databaseService.onModuleDestroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
