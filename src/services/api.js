import { PRODUCTS_MOCK } from '../data/products.js';

const DEFAULT_DELAY_MS = 300;

const delay = (ms = DEFAULT_DELAY_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
   * @param {number} [options.delayMs] - Simulated network latency in milliseconds
   * @returns {Promise<{ products: Array, total: number, page?: number, totalPages?: number }>}
   */
  async getProducts({
    category,
    search,
    sortBy,
    page,
    limit,
    delayMs = DEFAULT_DELAY_MS,
  } = {}) {
    await delay(delayMs);

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
};

export default productsApi;
