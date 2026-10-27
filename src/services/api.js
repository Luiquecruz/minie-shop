import { PRODUCTS_MOCK } from '../data/products.js';

const DEFAULT_DELAY_MS = 300;

const delay = (ms = DEFAULT_DELAY_MS, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(
        new DOMException('The user aborted a request.', 'AbortError'),
      );
    }

    const timeoutId = setTimeout(() => {
      resolve();
    }, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(
        new DOMException('The user aborted a request.', 'AbortError'),
      );
    });
  });

/**
 * Simulated API Service (Frontend-only)
 */
export const productsApi = {
  /**
   * Fetches the products list with optional search, category filter, sorting, and pagination.
   * @param {Object} options
   * @param {string} [options.category] - Category filter
   * @param {string} [options.search] - Search term (matches name or description)
   * @param {string} [options.sortBy] - 'price-asc' | 'price-desc' | 'rating' | 'name'
   * @param {number} [options.page] - Page number (1-based)
   * @param {number} [options.limit] - Items per page
   * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
   * @param {number} [options.delayMs] - Simulated network latency in milliseconds
   * @returns {Promise<{ products: Array, total: number, page?: number, totalPages?: number }>}
   */
  async getProducts({
    category,
    search,
    sortBy,
    page,
    limit,
    signal,
    delayMs = DEFAULT_DELAY_MS,
  } = {}) {
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
        result.sort(
          (a, b) =>
            (a.price?.final_price ?? a.price) -
            (b.price?.final_price ?? b.price),
        );
      } else if (sortBy === 'price-desc') {
        result.sort(
          (a, b) =>
            (b.price?.final_price ?? b.price) -
            (a.price?.final_price ?? a.price),
        );
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
   * @param {number|string} id
   * @param {number} [delayMs]
   * @returns {Promise<Object>}
   */
  async getProductById(id, delayMs = DEFAULT_DELAY_MS) {
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
   * @param {number} [delayMs]
   * @returns {Promise<string[]>}
   */
  async getCategories(delayMs = DEFAULT_DELAY_MS) {
    await delay(delayMs);
    const categories = Array.from(
      new Set(PRODUCTS_MOCK.map((p) => p.category)),
    );
    return categories;
  },

  /**
   * Fetches related products by category excluding current product.
   * @param {number|string} productId
   * @param {string} category
   * @param {number} [limit=4]
   * @param {number} [delayMs]
   * @returns {Promise<Array>}
   */
  async getRelatedProducts(
    productId,
    category,
    limit = 4,
    delayMs = DEFAULT_DELAY_MS,
  ) {
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
   * @param {Object} options
   * @param {string} options.query - Search query
   * @param {number} [options.limit=6] - Max results to return
   * @param {AbortSignal} [options.signal] - AbortSignal for request cancellation
   * @param {number} [options.delayMs=200] - Simulated network latency
   * @returns {Promise<Array>}
   */
  async searchProducts({ query = '', limit = 6, signal, delayMs = 200 } = {}) {
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
   * @param {number|string} productId
   * @param {number} requestedQuantity
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ available: boolean, maxStock: number, message: string|null }>}
   */
  async validateStock(productId, requestedQuantity, signal) {
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
