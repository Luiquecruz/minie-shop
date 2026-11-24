import type {
  CartCrossSellResponseDTO,
  CategoriesResponseDTO,
  CategoryDTO,
  FacetAttributeDTO,
  FacetCategoryDTO,
  FacetsDTO,
  FavoriteCreatedResponseDTO,
  FavoritesListResponseDTO,
  PricingQuoteRequestDTO,
  PricingQuoteResponseDTO,
  ProductCardDTO,
  ProductDetailDTO,
  ProductListResponseDTO,
  ProductRecommendationsResponseDTO,
  ProductSort,
  RecommendationType,
  SearchMode,
  SearchResponseDTO,
  SearchSuggestResponseDTO,
  SupportedCurrency,
} from '@minieshop/contracts';
import {
  DEFAULT_SEARCH_LIMIT,
  MAX_CROSS_SELL_PRODUCT_IDS,
  MAX_RECOMMENDATION_LIMIT,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_OFFSET,
  MAX_SUGGEST_LIMIT,
  type CatalogFilterParams,
  type CrossSellParams,
  type FacetsParams,
  type ListProductsParams,
  type ProductRecommendationsParams,
  type ProductRepository,
  type SearchProductsParams,
  type SuggestProductsParams,
} from '../../domain/repositories/ProductRepository';
import {
  FIXTURE_CATEGORIES,
  FIXTURE_PRODUCTS_DETAIL,
  toProductCard,
} from '../../test/fixtures/catalogFixture';
import { ApiError } from '../http/errors';

export type MockRecommendationsMap = Record<
  string,
  Partial<Record<RecommendationType, string[]>>
>;

export interface MockRepositoryErrorConfig {
  search?: Error | null;
  suggest?: Error | null;
  recommendations?: Error | null;
  crossSell?: Error | null;
}

export interface MockProductRepositoryOptions {
  products?: ProductDetailDTO[];
  categories?: CategoriesResponseDTO;
  initialFavorites?: string[];
  delayMs?: number;
  searchMode?: SearchMode;
  recommendationsBySlug?: MockRecommendationsMap;
  errorOn?: MockRepositoryErrorConfig;
}

const DEFAULT_RECOMMENDATION_LIMITS: Record<RecommendationType, number> = {
  related: 8,
  upsell: 4,
  cross_sell: 6,
};

const ALL_RECOMMENDATION_TYPES: readonly RecommendationType[] = [
  'related',
  'upsell',
  'cross_sell',
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Default deterministic relations across `FIXTURE_PRODUCTS_DETAIL`:
 * - product[0] (`fone-de-ouvido-bluetooth-over-ear-pro`): includes an OOS item (`[3]`) in related to verify filtering.
 * - product[5] (`vela-aromatica-soja-e-baunilha`): intentionally has no relations so empty-state tests work cleanly.
 */
const DEFAULT_FIXTURE_RECOMMENDATIONS: MockRecommendationsMap = {
  'fone-de-ouvido-bluetooth-over-ear-pro': {
    related: [
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000004', // out of stock -> filtered
    ],
    upsell: ['20000000-0000-4000-8000-000000000003'],
    cross_sell: [
      '20000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000006',
    ],
  },
  'caixa-de-som-portatil-bluetooth-ipx7': {
    related: ['20000000-0000-4000-8000-000000000001'],
    upsell: ['20000000-0000-4000-8000-000000000001'],
    cross_sell: [
      '20000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000006',
    ],
  },
  'teclado-mecanico-rgb-compacto-aluminio': {
    related: ['20000000-0000-4000-8000-000000000001'],
    upsell: [],
    cross_sell: [
      '20000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000006',
    ],
  },
  'organizador-de-mesa-em-madeira-e-aluminio': {
    related: ['20000000-0000-4000-8000-000000000006'],
    upsell: ['20000000-0000-4000-8000-000000000003'],
    cross_sell: [
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
    ],
  },
  'vela-aromatica-soja-e-baunilha': {
    related: [],
    upsell: [],
    cross_sell: [],
  },
};

const SEMANTIC_HINTS: Array<{ queryTokens: string[]; productTerms: string[] }> = [
  {
    queryTokens: ['aviao', 'viajar', 'viagem', 'barulho', 'silencio'],
    productTerms: ['cancelamento', 'ruido', 'bluetooth', 'fone'],
  },
  {
    queryTokens: ['escritorio', 'trabalho', 'home'],
    productTerms: ['teclado', 'organizador', 'mesa'],
  },
];

const MOCK_SERVER_RATES: Record<SupportedCurrency, number> = {
  BRL: 1,
  USD: 0.2,
  EUR: 0.185,
};

const MOCK_SHIPPING_PRICING: Record<
  SupportedCurrency,
  {
    freeShippingThresholdCents: number;
    shippingOptions: Array<{
      id: 'standard' | 'express' | 'pickup';
      basePriceCents: number;
    }>;
  }
> = {
  BRL: {
    freeShippingThresholdCents: 50_000,
    shippingOptions: [
      { id: 'standard', basePriceCents: 1_990 },
      { id: 'express', basePriceCents: 4_990 },
      { id: 'pickup', basePriceCents: 0 },
    ],
  },
  USD: {
    freeShippingThresholdCents: 10_000,
    shippingOptions: [
      { id: 'standard', basePriceCents: 490 },
      { id: 'express', basePriceCents: 990 },
      { id: 'pickup', basePriceCents: 0 },
    ],
  },
  EUR: {
    freeShippingThresholdCents: 9_500,
    shippingOptions: [
      { id: 'standard', basePriceCents: 450 },
      { id: 'express', basePriceCents: 890 },
      { id: 'pickup', basePriceCents: 0 },
    ],
  },
};

function priceProductForCurrency(
  product: ProductDetailDTO,
  currency: SupportedCurrency = 'BRL',
): ProductDetailDTO {
  if (product.price.currency === currency) {
    return product;
  }
  const sourceRate = MOCK_SERVER_RATES[product.price.currency] || 1;
  const targetRate = MOCK_SERVER_RATES[currency];
  return {
    ...product,
    price: {
      amount: Math.round((product.price.amount / sourceRate) * targetRate),
      currency,
    },
  };
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    if (signal?.aborted) {
      return Promise.reject(new DOMException('The request was aborted.', 'AbortError'));
    }
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The request was aborted.', 'AbortError'));
      return;
    }

    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new DOMException('The request was aborted.', 'AbortError'));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function createValidationError(path: string, message: string): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    requestId: 'mock-request-id',
    details: [{ path, message }],
  });
}

function collectCategorySubtreeSlugs(
  categories: CategoryDTO[],
  targetSlug: string,
): Set<string> | null {
  for (const cat of categories) {
    if (cat.slug === targetSlug) {
      const slugs = new Set<string>();
      const walk = (node: CategoryDTO): void => {
        slugs.add(node.slug);
        node.children.forEach(walk);
      };
      walk(cat);
      return slugs;
    }
    const found = collectCategorySubtreeSlugs(cat.children, targetSlug);
    if (found) return found;
  }
  return null;
}

function flattenCategories(categories: CategoryDTO[]): CategoryDTO[] {
  const result: CategoryDTO[] = [];
  const walk = (nodes: CategoryDTO[]): void => {
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  };
  walk(categories);
  return result;
}

function matchesFilters(
  product: ProductDetailDTO,
  categories: CategoryDTO[],
  filters: CatalogFilterParams,
  omit?: {
    category?: boolean;
    price?: boolean;
    attributeCode?: string;
  },
): boolean {
  if (!omit?.category && filters.category) {
    const allowedSlugs = collectCategorySubtreeSlugs(categories, filters.category);
    if (!allowedSlugs || !allowedSlugs.has(product.category.slug)) {
      return false;
    }
  }

  if (!omit?.price) {
    if (filters.minPrice !== undefined && product.price.amount < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice !== undefined && product.price.amount > filters.maxPrice) {
      return false;
    }
  }

  if (filters.inStock !== undefined && product.inStock !== filters.inStock) {
    return false;
  }

  if (filters.q && filters.q.trim().length > 0) {
    const term = normalizeText(filters.q.trim());
    const haystack = normalizeText(
      `${product.name} ${product.description} ${product.category.name}`,
    );
    if (!haystack.includes(term)) {
      return false;
    }
  }

  if (filters.attributes) {
    for (const [code, values] of Object.entries(filters.attributes)) {
      if (omit?.attributeCode === code || values.length === 0) continue;
      const attr = product.attributes.find((item) => item.code === code);
      if (!attr || !values.includes(String(attr.value))) {
        return false;
      }
    }
  }

  if (filters.numericAttributes) {
    for (const [code, range] of Object.entries(filters.numericAttributes)) {
      if (omit?.attributeCode === code) continue;
      if (range.min === undefined && range.max === undefined) continue;
      const attr = product.attributes.find((item) => item.code === code);
      if (!attr || typeof attr.value !== 'number') {
        return false;
      }
      if (range.min !== undefined && attr.value < range.min) return false;
      if (range.max !== undefined && attr.value > range.max) return false;
    }
  }

  return true;
}

function sortProducts(
  items: ProductDetailDTO[],
  sort: ProductSort = 'newest',
): ProductDetailDTO[] {
  const copy = [...items];
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) => a.price.amount - b.price.amount || a.id.localeCompare(b.id));
    case 'price_desc':
      return copy.sort((a, b) => b.price.amount - a.price.amount || a.id.localeCompare(b.id));
    case 'name_asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    case 'relevance':
    case 'newest':
    default:
      return copy;
  }
}

function matchesSearchQuery(
  product: ProductDetailDTO,
  rawQuery: string,
  mode: SearchMode,
): boolean {
  const normalizedQuery = normalizeText(rawQuery.trim());
  const haystack = normalizeText(
    `${product.name} ${product.description} ${product.category.name} ${product.attributes
      .map((attr) => `${attr.label} ${String(attr.value)}`)
      .join(' ')}`,
  );

  if (haystack.includes(normalizedQuery)) {
    return true;
  }

  const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length >= 2);
  if (tokens.length > 1 && tokens.every((token) => haystack.includes(token))) {
    return true;
  }

  if (mode === 'hybrid') {
    for (const hint of SEMANTIC_HINTS) {
      const hasIntent = tokens.some((token) => hint.queryTokens.includes(token));
      const hasProductSignal = hint.productTerms.some((term) => haystack.includes(term));
      if (hasIntent && hasProductSignal) {
        return true;
      }
    }
  }

  return false;
}

export class MockProductRepository implements ProductRepository {
  private readonly products: ProductDetailDTO[];
  private readonly categories: CategoriesResponseDTO;
  private readonly favorites: Set<string>;
  private readonly delayMs: number;
  private searchMode: SearchMode;
  private readonly recommendationsBySlug: MockRecommendationsMap;
  private errorOn: MockRepositoryErrorConfig;

  constructor(options: MockProductRepositoryOptions = {}) {
    this.products = options.products ?? FIXTURE_PRODUCTS_DETAIL;
    this.categories = options.categories ?? FIXTURE_CATEGORIES;
    this.favorites = new Set(options.initialFavorites ?? []);
    this.delayMs = options.delayMs ?? 0;
    this.searchMode = options.searchMode ?? 'hybrid';
    this.recommendationsBySlug =
      options.recommendationsBySlug ?? DEFAULT_FIXTURE_RECOMMENDATIONS;
    this.errorOn = options.errorOn ?? {};
  }

  setSearchMode(mode: SearchMode): void {
    this.searchMode = mode;
  }

  setErrorOn(errorOn: MockRepositoryErrorConfig): void {
    this.errorOn = errorOn;
  }

  async listProducts(
    params: ListProductsParams = {},
    signal?: AbortSignal,
  ): Promise<ProductListResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);

    const currency = params.currency ?? 'BRL';
    const pricedProducts = this.products.map((product) =>
      priceProductForCurrency(product, currency),
    );
    const filtered = pricedProducts.filter((product) =>
      matchesFilters(product, this.categories, params),
    );
    const sorted = sortProducts(filtered, params.sort);
    const limit = Math.min(60, Math.max(1, params.limit ?? 24));

    let offset = 0;
    if (params.cursor) {
      const parsedOffset = Number(params.cursor);
      if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        throw createValidationError('cursor', 'Invalid pagination cursor');
      }
      offset = parsedOffset;
    }

    const slice = sorted.slice(offset, offset + limit);
    const nextOffset = offset + slice.length;
    const nextCursor = nextOffset < sorted.length ? String(nextOffset) : null;

    return {
      items: slice.map(toProductCard),
      nextCursor,
    };
  }

  async getProductBySlug(
    slug: string,
    signal?: AbortSignal,
    currency: SupportedCurrency = 'BRL',
  ): Promise<ProductDetailDTO> {
    await sleepWithAbort(this.delayMs, signal);

    const found = this.products.find((product) => product.slug === slug);
    if (!found) {
      throw new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        message: `Product "${slug}" not found`,
        requestId: 'mock-request-id',
      });
    }
    return priceProductForCurrency(found, currency);
  }

  async getCategories(signal?: AbortSignal): Promise<CategoriesResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);
    return this.categories;
  }

  async getFacets(
    params: FacetsParams = {},
    signal?: AbortSignal,
  ): Promise<FacetsDTO> {
    await sleepWithAbort(this.delayMs, signal);

    const currency = params.currency ?? 'BRL';
    const pricedProducts = this.products.map((product) =>
      priceProductForCurrency(product, currency),
    );

    const pricePool = pricedProducts.filter((product) =>
      matchesFilters(product, this.categories, params, { price: true }),
    );
    const price =
      pricePool.length === 0
        ? { min: null, max: null }
        : {
            min: Math.min(...pricePool.map((p) => p.price.amount)),
            max: Math.max(...pricePool.map((p) => p.price.amount)),
          };

    const categoryPool = pricedProducts.filter((product) =>
      matchesFilters(product, this.categories, params, { category: true }),
    );
    const allCats = flattenCategories(this.categories);
    const categories: FacetCategoryDTO[] = allCats
      .map((cat) => {
        const subtree = collectCategorySubtreeSlugs(this.categories, cat.slug);
        const count = categoryPool.filter((p) =>
          subtree ? subtree.has(p.category.slug) : false,
        ).length;
        return { slug: cat.slug, name: cat.name, count };
      })
      .filter((cat) => cat.count > 0);

    const attrMeta = new Map<
      string,
      { label: string; type: 'string' | 'number' | 'boolean'; unit?: string }
    >();
    for (const product of this.products) {
      for (const attr of product.attributes) {
        if (!attrMeta.has(attr.code)) {
          const type =
            typeof attr.value === 'boolean'
              ? 'boolean'
              : typeof attr.value === 'number'
                ? 'number'
                : 'string';
          attrMeta.set(attr.code, {
            label: attr.label,
            type,
            unit: attr.unit,
          });
        }
      }
    }

    const attributes: FacetAttributeDTO[] = [];
    for (const [code, meta] of attrMeta.entries()) {
      const attrPool = pricedProducts.filter((product) =>
        matchesFilters(product, this.categories, params, { attributeCode: code }),
      );

      if (meta.type === 'number') {
        const numbers = attrPool
          .map((p) => p.attributes.find((a) => a.code === code)?.value)
          .filter((v): v is number => typeof v === 'number');
        if (numbers.length > 0) {
          attributes.push({
            code,
            label: meta.label,
            type: 'number',
            unit: meta.unit,
            range: {
              min: Math.min(...numbers),
              max: Math.max(...numbers),
            },
          });
        }
      } else {
        const counts = new Map<string, number>();
        for (const product of attrPool) {
          const attr = product.attributes.find((a) => a.code === code);
          if (attr !== undefined) {
            const key = String(attr.value);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
        if (counts.size > 0) {
          attributes.push({
            code,
            label: meta.label,
            type: meta.type,
            unit: meta.unit,
            options: Array.from(counts.entries())
              .map(([value, count]) => ({ value, count }))
              .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
          });
        }
      }
    }

    return {
      price,
      categories,
      attributes,
    };
  }

  async quotePricing(
    request: PricingQuoteRequestDTO,
    signal?: AbortSignal,
  ): Promise<PricingQuoteResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);
    const currency = request.currency ?? 'BRL';
    const shipping = MOCK_SHIPPING_PRICING[currency];
    const uniqueIds = Array.from(
      new Set(request.productIds.map((id) => id.toLowerCase())),
    );
    const items = uniqueIds
      .map((productId) => {
        const found = this.products.find(
          (product) => product.id.toLowerCase() === productId,
        );
        if (!found) return null;
        const priced = priceProductForCurrency(found, currency);
        return {
          productId: priced.id,
          price: priced.price,
          inStock: priced.inStock,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      currency,
      items,
      freeShippingThresholdCents: shipping.freeShippingThresholdCents,
      shippingOptions: shipping.shippingOptions.map((option) => ({ ...option })),
    };
  }

  async getFavorites(signal?: AbortSignal): Promise<FavoritesListResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);
    return { productIds: Array.from(this.favorites) };
  }

  async addFavorite(
    productId: string,
    signal?: AbortSignal,
  ): Promise<FavoriteCreatedResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);
    const exists = this.products.some((product) => product.id === productId);
    if (!exists) {
      throw new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        message: `Product "${productId}" not found`,
        requestId: 'mock-request-id',
      });
    }
    this.favorites.add(productId);
    return { favorited: true };
  }

  async removeFavorite(productId: string, signal?: AbortSignal): Promise<void> {
    await sleepWithAbort(this.delayMs, signal);
    const exists = this.products.some((product) => product.id === productId);
    if (!exists) {
      throw new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        message: `Product "${productId}" not found`,
        requestId: 'mock-request-id',
      });
    }
    this.favorites.delete(productId);
  }

  async searchProducts(
    params: SearchProductsParams,
    signal?: AbortSignal,
  ): Promise<SearchResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);
    if (this.errorOn.search) {
      throw this.errorOn.search;
    }

    const q = params.q.trim();
    if (q.length === 0) {
      throw createValidationError('q', 'Query parameter "q" is required');
    }

    const limit = params.limit ?? DEFAULT_SEARCH_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
      throw createValidationError(
        'limit',
        `limit must be between 1 and ${MAX_SEARCH_LIMIT}`,
      );
    }

    const offset = params.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0 || offset > MAX_SEARCH_OFFSET) {
      throw createValidationError(
        'offset',
        `offset must be between 0 and ${MAX_SEARCH_OFFSET}`,
      );
    }

    if (
      params.minPrice !== undefined &&
      params.maxPrice !== undefined &&
      params.minPrice > params.maxPrice
    ) {
      throw createValidationError(
        'minPrice',
        'minPrice must be less than or equal to maxPrice',
      );
    }

    const effectiveMode: SearchMode =
      this.searchMode === 'postgres'
        ? 'postgres'
        : params.mode === 'keyword'
          ? 'keyword'
          : this.searchMode;

    const filtered = this.products.filter((product) => {
      if (!matchesSearchQuery(product, q, effectiveMode)) {
        return false;
      }
      return matchesFilters(product, this.categories, {
        category: params.category,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        inStock: params.inStock,
      });
    });

    const pageSlice = filtered.slice(offset, offset + limit);

    return {
      items: pageSlice.map(toProductCard),
      estimatedTotal: filtered.length,
      mode: effectiveMode,
    };
  }

  async suggestProducts(
    params: SuggestProductsParams,
    signal?: AbortSignal,
  ): Promise<SearchSuggestResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);
    if (this.errorOn.suggest) {
      throw this.errorOn.suggest;
    }

    const q = params.q.trim();
    if (q.length === 0) {
      throw createValidationError('q', 'Query parameter "q" is required');
    }

    const limit = params.limit ?? MAX_SUGGEST_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SUGGEST_LIMIT) {
      throw createValidationError(
        'limit',
        `limit must be between 1 and ${MAX_SUGGEST_LIMIT}`,
      );
    }

    const normalized = normalizeText(q);
    const matching = this.products
      .filter((product) => {
        const haystack = normalizeText(`${product.name} ${product.category.name}`);
        return haystack.includes(normalized);
      })
      .slice(0, limit)
      .map((product) => ({
        slug: product.slug,
        name: product.name,
        categoryName: product.category.name,
      }));

    return {
      suggestions: matching,
      mode: this.searchMode === 'postgres' ? 'postgres' : 'keyword',
    };
  }

  async getProductRecommendations(
    params: ProductRecommendationsParams,
    signal?: AbortSignal,
  ): Promise<ProductRecommendationsResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);
    if (this.errorOn.recommendations) {
      throw this.errorOn.recommendations;
    }

    const sourceProduct = this.products.find((p) => p.slug === params.slug);
    if (!sourceProduct) {
      throw new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        message: `Product "${params.slug}" not found`,
        requestId: 'mock-request-id',
      });
    }

    if (
      params.limit !== undefined &&
      (!Number.isInteger(params.limit) ||
        params.limit < 1 ||
        params.limit > MAX_RECOMMENDATION_LIMIT)
    ) {
      throw createValidationError(
        'limit',
        `limit must be between 1 and ${MAX_RECOMMENDATION_LIMIT}`,
      );
    }

    const requestedTypes: RecommendationType[] =
      params.types && params.types.length > 0
        ? Array.from(new Set(params.types))
        : [...ALL_RECOMMENDATION_TYPES];

    const byId = new Map(this.products.map((product) => [product.id, product]));
    const configured = this.recommendationsBySlug[params.slug] ?? {};
    const response: ProductRecommendationsResponseDTO = {};

    for (const type of requestedTypes) {
      const limit = params.limit ?? DEFAULT_RECOMMENDATION_LIMITS[type];
      const targetIds = configured[type] ?? [];
      const cards: ProductCardDTO[] = [];

      for (const id of targetIds) {
        if (cards.length >= limit) break;
        const candidate = byId.get(id);
        if (!candidate || !candidate.inStock || candidate.id === sourceProduct.id) {
          continue;
        }
        cards.push(toProductCard(candidate));
      }

      response[type] = cards;
    }

    return response;
  }

  async getCrossSell(
    params: CrossSellParams,
    signal?: AbortSignal,
  ): Promise<CartCrossSellResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);
    if (this.errorOn.crossSell) {
      throw this.errorOn.crossSell;
    }

    const uniqueInputIds = Array.from(
      new Set(params.productIds.map((id) => id.trim()).filter(Boolean)),
    );

    if (uniqueInputIds.length === 0) {
      throw createValidationError(
        'productIds',
        'productIds must contain at least one UUID',
      );
    }

    if (uniqueInputIds.length > MAX_CROSS_SELL_PRODUCT_IDS) {
      throw createValidationError(
        'productIds',
        `productIds accepts at most ${MAX_CROSS_SELL_PRODUCT_IDS} IDs`,
      );
    }

    for (const id of uniqueInputIds) {
      if (!UUID_REGEX.test(id)) {
        throw createValidationError(
          'productIds',
          `Invalid UUID "${id}" in productIds`,
        );
      }
    }

    const limit = params.limit ?? DEFAULT_RECOMMENDATION_LIMITS.cross_sell;
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_RECOMMENDATION_LIMIT
    ) {
      throw createValidationError(
        'limit',
        `limit must be between 1 and ${MAX_RECOMMENDATION_LIMIT}`,
      );
    }

    const inputSet = new Set(uniqueInputIds.map((id) => id.toLowerCase()));
    const byId = new Map(
      this.products.map((product) => [product.id.toLowerCase(), product]),
    );
    const seenResultIds = new Set<string>();
    const items: ProductCardDTO[] = [];

    for (const inputId of uniqueInputIds) {
      const source = byId.get(inputId.toLowerCase());
      if (!source) continue;

      const crossSellIds = this.recommendationsBySlug[source.slug]?.cross_sell ?? [];
      for (const candidateId of crossSellIds) {
        const lowerCandidate = candidateId.toLowerCase();
        if (inputSet.has(lowerCandidate) || seenResultIds.has(lowerCandidate)) {
          continue;
        }
        const candidate = byId.get(lowerCandidate);
        if (!candidate || !candidate.inStock) {
          continue;
        }
        seenResultIds.add(lowerCandidate);
        items.push(toProductCard(candidate));
        if (items.length >= limit) {
          return { items };
        }
      }
    }

    return { items };
  }
}
