import { createHash } from 'node:crypto';
import type { SearchIndexDocument } from '../catalog/index.js';

export const EMBEDDING_TEMPLATE_VERSION = 'v1';

export function buildProductEmbeddingText(doc: SearchIndexDocument): string {
  const lines: string[] = [
    `Produto: ${doc.name.trim()}`,
    `Categoria: ${doc.categoryNames.trim()}`,
  ];

  if (doc.brand && doc.brand.trim().length > 0) {
    lines.push(`Marca: ${doc.brand.trim()}`);
  }

  if (doc.description.trim().length > 0) {
    lines.push(`Descrição: ${doc.description.trim()}`);
  }

  if (doc.attributesText.trim().length > 0) {
    lines.push(`Especificações: ${doc.attributesText.trim()}`);
  }

  return lines.join('\n');
}

export function computeEmbeddingContentHash(params: {
  model: string;
  templateVersion: string;
  text: string;
}): string {
  return createHash('sha256')
    .update(`${params.model}\n${params.templateVersion}\n${params.text}`, 'utf8')
    .digest('hex');
}

export function formatEmbeddingDocumentForModel(
  modelName: string,
  title: string,
  text: string,
): string {
  const normalizedModel = modelName.toLowerCase();
  if (normalizedModel.startsWith('embeddinggemma')) {
    const cleanTitle = title.trim().length > 0 ? title.trim() : 'none';
    return `title: ${cleanTitle} | text: ${text.trim()}`;
  }
  // bge-m3 and symmetric models use plain text without prefix
  return text.trim();
}

export function formatEmbeddingQueryForModel(modelName: string, query: string): string {
  const normalizedModel = modelName.toLowerCase();
  if (normalizedModel.startsWith('embeddinggemma')) {
    return `task: search result | query: ${query.trim()}`;
  }
  // bge-m3 model card: no query prefix needed
  return query.trim();
}
