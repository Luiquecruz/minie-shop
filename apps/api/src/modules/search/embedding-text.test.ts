import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMBEDDING_TEMPLATE_VERSION,
  buildProductEmbeddingText,
  computeEmbeddingContentHash,
  formatEmbeddingDocumentForModel,
  formatEmbeddingQueryForModel,
} from './embedding-text.js';

describe('S06 — Pure Embedding Text Builder & Content Hash', () => {
  const sampleDoc = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'fone-pro',
    name: 'Fone Over-Ear Pro',
    description: 'Fone bluetooth com cancelamento ativo de ruído',
    brand: 'AudioLab',
    categoryPath: ['eletronicos', 'audio'],
    categoryNames: 'Eletrônicos > Áudio',
    attributesText: 'Autonomia: 40 h | Cancelamento de ruído',
    price: 29990,
    inStock: true,
    createdAt: 1700000000000,
  };

  it('builds deterministic text containing name, category, brand, description, and attributes', () => {
    const text1 = buildProductEmbeddingText(sampleDoc);
    const text2 = buildProductEmbeddingText(sampleDoc);
    assert.equal(text1, text2);
    assert.ok(text1.includes('Produto: Fone Over-Ear Pro'));
    assert.ok(text1.includes('Categoria: Eletrônicos > Áudio'));
    assert.ok(text1.includes('Marca: AudioLab'));
    assert.ok(text1.includes('Descrição: Fone bluetooth com cancelamento ativo de ruído'));
    assert.ok(text1.includes('Especificações: Autonomia: 40 h | Cancelamento de ruído'));
  });

  it('changes content hash when model, templateVersion, or text changes', () => {
    const text = buildProductEmbeddingText(sampleDoc);
    const h1 = computeEmbeddingContentHash({
      model: 'bge-m3',
      templateVersion: EMBEDDING_TEMPLATE_VERSION,
      text,
    });
    const h2 = computeEmbeddingContentHash({
      model: 'embeddinggemma',
      templateVersion: EMBEDDING_TEMPLATE_VERSION,
      text,
    });
    const h3 = computeEmbeddingContentHash({
      model: 'bge-m3',
      templateVersion: 'v2',
      text,
    });
    const h4 = computeEmbeddingContentHash({
      model: 'bge-m3',
      templateVersion: EMBEDDING_TEMPLATE_VERSION,
      text: `${text} extra`,
    });

    assert.notEqual(h1, h2);
    assert.notEqual(h1, h3);
    assert.notEqual(h1, h4);
  });

  it('applies asymmetric prefixes for embeddinggemma and plain text for bge-m3', () => {
    assert.equal(formatEmbeddingQueryForModel('bge-m3', 'presente para café'), 'presente para café');
    assert.equal(
      formatEmbeddingDocumentForModel('bge-m3', 'Prensa', 'Cafeteira inox'),
      'Cafeteira inox',
    );
    assert.equal(
      formatEmbeddingQueryForModel('embeddinggemma', 'presente para café'),
      'task: search result | query: presente para café',
    );
    assert.equal(
      formatEmbeddingDocumentForModel('embeddinggemma', 'Prensa', 'Cafeteira inox'),
      'title: Prensa | text: Cafeteira inox',
    );
  });
});
