import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const synonymsPath = resolve(currentDir, 'synonyms.pt.json');

export interface ProductsIndexSettings {
  searchableAttributes: string[];
  filterableAttributes: string[];
  sortableAttributes: string[];
  synonyms: Record<string, string[]>;
  localizedAttributes: Array<{
    attributePatterns: string[];
    locales: string[];
  }>;
  embedders?: Record<
    string,
    {
      source: 'userProvided';
      dimensions: number;
    }
  >;
}

export function loadPortugueseSynonyms(): Record<string, string[]> {
  const raw = readFileSync(synonymsPath, 'utf8');
  return JSON.parse(raw) as Record<string, string[]>;
}

export function buildProductsIndexSettings(options?: {
  embedderName?: string;
  embedderDimensions?: number;
}): ProductsIndexSettings {
  const settings: ProductsIndexSettings = {
    searchableAttributes: ['name', 'categoryNames', 'description', 'attributesText', 'brand'],
    filterableAttributes: ['categoryPath', 'price', 'inStock'],
    sortableAttributes: ['price', 'createdAt'],
    synonyms: loadPortugueseSynonyms(),
    localizedAttributes: [
      {
        attributePatterns: ['name', 'categoryNames', 'description', 'attributesText'],
        locales: ['por'],
      },
    ],
  };

  if (options?.embedderDimensions && options.embedderDimensions > 0) {
    const embedderName = options.embedderName ?? 'semantic';
    settings.embedders = {
      [embedderName]: {
        source: 'userProvided',
        dimensions: options.embedderDimensions,
      },
    };
  }

  return settings;
}
