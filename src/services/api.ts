import type {
  GetProductsParams,
  PaginatedProductsResponse,
  Product,
  SearchProductsParams,
  StockValidationResult,
} from '../types';
import { PRODUCTS_MOCK } from '../data/products';

const DEFAULT_DELAY_MS = 300;

const delay = (ms: number = DEFAULT_DELAY_MS, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The user aborted a request.', 'AbortError'));
      return;
    }

    const timeoutId = setTimeout(() => {
      resolve();
    }, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new DOMException('The user aborted a request.', 'AbortError'));
    });
  });

/**
 * Simulated API Service (Frontend-only)
 */
export const productsApi = {
  /**
   * Fetches the products list with optional search, category filter, sorting, and pagination.
   */
  async getProducts({
    category,
    search,
    sortBy,
    page,
    limit,
    signal,
    delayMs = DEFAULT_DELAY_MS,
  }: GetProductsParams = {}): Promise<PaginatedProductsResponse> {
    await delay(delayMs, signal);

    let result = [...PRODUCTS_MOCK];

    if (category && category !== 'Todos') {
      result = result.filter(
        (p) => p.category.toLowerCase() === category.toLowerCase(),
      );
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term),
      );
    }

    if (sortBy) {
      if (sortBy === 'price-asc') {
        result.sort((a, b) => a.price.final_price - b.price.final_price);
      } else if (sortBy === 'price-desc') {
        result.sort((a, b) => b.price.final_price - a.price.final_price);
      } else if (sortBy === 'rating') {
        result.sort((a, b) => b.rating.rate - a.rating.rate);
      } else if (sortBy === 'name') {
        result.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    const total = result.length;

    if (page && limit) {
      const startIndex = (page - 1) * limit;
      const paginated = result.slice(startIndex, startIndex + limit);
      return {
        products: paginated,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }

    return {
      products: result,
      total,
    };
  },

  /**
   * Fetches a single product by ID.
   */
  async getProductById(
    id: number | string,
    delayMs: number = DEFAULT_DELAY_MS,
  ): Promise<Product> {
    await delay(delayMs);
    const numericId = Number(id);
    const product = PRODUCTS_MOCK.find((p) => p.id === numericId);

    if (!product) {
      throw new Error(`Product with ID ${id} not found.`);
    }

    return product;
  },

  /**
   * Returns list of unique available categories.
   */
  async getCategories(delayMs: number = DEFAULT_DELAY_MS): Promise<string[]> {
    await delay(delayMs);
    const categories = Array.from(
      new Set(PRODUCTS_MOCK.map((p) => p.category)),
    );
    return categories;
  },

  /**
   * Fetches related products by category excluding current product.
   */
  async getRelatedProducts(
    productId: number | string,
    category: string,
    limit: number = 4,
    delayMs: number = DEFAULT_DELAY_MS,
  ): Promise<Product[]> {
    await delay(delayMs);
    const numericId = Number(productId);
    let related = PRODUCTS_MOCK.filter(
      (p) =>
        p.id !== numericId &&
        p.category.toLowerCase() === (category || '').toLowerCase(),
    );

    if (related.length < limit) {
      const others = PRODUCTS_MOCK.filter(
        (p) => p.id !== numericId && !related.some((r) => r.id === p.id),
      );
      related = [...related, ...others];
    }

    return related.slice(0, limit);
  },

  /**
   * Dedicated search endpoint with AbortSignal support for autocomplete.
   */
  async searchProducts({
    query = '',
    limit = 6,
    signal,
    delayMs = 200,
  }: SearchProductsParams = {}): Promise<Product[]> {
    await delay(delayMs, signal);

    if (!query || !query.trim()) {
      return [];
    }

    const term = query.trim().toLowerCase();
    const results = PRODUCTS_MOCK.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term),
    );

    return results.slice(0, limit);
  },

  /**
   * Validates available stock for a product with AbortSignal support.
   * Used by debounced quantity updates in mini-cart.
   */
  async validateStock(
    productId: number | string,
    requestedQuantity: number,
    signal?: AbortSignal,
  ): Promise<StockValidationResult> {
    await delay(150, signal);
    const numericId = Number(productId);
    const product = PRODUCTS_MOCK.find((p) => p.id === numericId);

    if (!product) {
      throw new Error(`Product with ID ${productId} not found.`);
    }

    const maxStock = typeof product.stock === 'number' ? product.stock : 99;
    const available = requestedQuantity <= maxStock;

    return {
      available,
      maxStock,
      message: available ? null : `Only ${maxStock} units available in stock.`,
    };
  },
};

export default productsApi;
