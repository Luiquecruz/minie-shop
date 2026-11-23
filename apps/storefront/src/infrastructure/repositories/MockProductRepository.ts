import type {
  CategoriesResponseDTO,
  CategoryDTO,
  FacetAttributeDTO,
  FacetCategoryDTO,
  FacetsDTO,
  FavoriteCreatedResponseDTO,
  FavoritesListResponseDTO,
  ProductDetailDTO,
  ProductListResponseDTO,
  ProductSort,
} from '@minieshop/contracts';
import type {
  CatalogFilterParams,
  FacetsParams,
  ListProductsParams,
  ProductRepository,
} from '../../domain/repositories/ProductRepository';
import {
  FIXTURE_CATEGORIES,
  FIXTURE_PRODUCTS_DETAIL,
  toProductCard,
} from '../../test/fixtures/catalogFixture';
import { ApiError } from '../http/errors';

export interface MockProductRepositoryOptions {
  products?: ProductDetailDTO[];
  categories?: CategoriesResponseDTO;
  initialFavorites?: string[];
  delayMs?: number;
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
    const haystack = normalizeText(`${product.name} ${product.description} ${product.category.name}`);
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

export class MockProductRepository implements ProductRepository {
  private readonly products: ProductDetailDTO[];
  private readonly categories: CategoriesResponseDTO;
  private readonly favorites: Set<string>;
  private readonly delayMs: number;

  constructor(options: MockProductRepositoryOptions = {}) {
    this.products = options.products ?? FIXTURE_PRODUCTS_DETAIL;
    this.categories = options.categories ?? FIXTURE_CATEGORIES;
    this.favorites = new Set(options.initialFavorites ?? []);
    this.delayMs = options.delayMs ?? 0;
  }

  async listProducts(
    params: ListProductsParams = {},
    signal?: AbortSignal,
  ): Promise<ProductListResponseDTO> {
    await sleepWithAbort(this.delayMs, signal);

    const filtered = this.products.filter((product) =>
      matchesFilters(product, this.categories, params),
    );
    const sorted = sortProducts(filtered, params.sort);
    const limit = Math.min(60, Math.max(1, params.limit ?? 24));

    let offset = 0;
    if (params.cursor) {
      const parsedOffset = Number(params.cursor);
      if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        throw new ApiError({
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Invalid pagination cursor',
          requestId: 'mock-request-id',
          details: [{ path: 'cursor', message: 'Invalid pagination cursor' }],
        });
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
    return found;
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

    const pricePool = this.products.filter((product) =>
      matchesFilters(product, this.categories, params, { price: true }),
    );
    const price =
      pricePool.length === 0
        ? { min: null, max: null }
        : {
            min: Math.min(...pricePool.map((p) => p.price.amount)),
            max: Math.max(...pricePool.map((p) => p.price.amount)),
          };

    const categoryPool = this.products.filter((product) =>
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
      const attrPool = this.products.filter((product) =>
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
}
