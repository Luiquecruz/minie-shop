import type {
  ApiErrorSimulationState,
  GetProductsParams,
  PaginatedProductsResponse,
  Product,
  SearchProductsParams,
  StockValidationResult,
} from '../types';
import { PRODUCTS_MOCK } from '../data/products';

const DEFAULT_DELAY_MS = 300;
const FAVORITES_STORAGE_KEY = 'minieshop_favorites';

let memoryFavoritesFallback: number[] = [];
let useMemoryFavorites = false;

/**
 * Domain error thrown when a requested product ID does not exist in the catalog.
 * React Query skips automatic retries for this error.
 */
export class ProductNotFoundError extends Error {
  constructor(id: number | string) {
    super(`Product with ID ${id} not found.`);
    this.name = 'ProductNotFoundError';
  }
}

/**
 * Observable error simulation controller for testing React Query retries,
 * error states, and optimistic mutation rollbacks.
 */
class ApiErrorSimulator {
  private state: ApiErrorSimulationState = {
    failQueries: false,
    failFavoritesMutation: false,
  };

  private listeners = new Set<() => void>();

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ApiErrorSimulationState => this.state;

  setFailQueries = (enabled: boolean): void => {
    if (this.state.failQueries === enabled) return;
    this.state = { ...this.state, failQueries: enabled };
    this.emit();
  };

  setFailFavoritesMutation = (enabled: boolean): void => {
    if (this.state.failFavoritesMutation === enabled) return;
    this.state = { ...this.state, failFavoritesMutation: enabled };
    this.emit();
  };

  reset = (): void => {
    if (!this.state.failQueries && !this.state.failFavoritesMutation) return;
    this.state = { failQueries: false, failFavoritesMutation: false };
    this.emit();
  };
}

export const apiErrorSimulator = new ApiErrorSimulator();

function readPersistedFavorites(): number[] {
  if (useMemoryFavorites || typeof window === 'undefined') {
    return memoryFavoritesFallback;
  }

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is number => typeof item === 'number' && Number.isInteger(item),
    );
  } catch {
    return memoryFavoritesFallback;
  }
}

function writePersistedFavorites(favoriteIds: number[]): void {
  memoryFavoritesFallback = favoriteIds;
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(favoriteIds),
    );
    useMemoryFavorites = false;
  } catch {
    // Storage may still be readable but contain stale IDs.
    useMemoryFavorites = true;
  }
}

const delay = (ms: number = DEFAULT_DELAY_MS, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The user aborted a request.', 'AbortError'));
      return;
    }

    const onAbort = (): void => {
      clearTimeout(timeoutId);
      reject(new DOMException('The user aborted a request.', 'AbortError'));
    };

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });

function assertQueryHealthy(operationName: string): void {
  if (apiErrorSimulator.getSnapshot().failQueries) {
    throw new Error(
      `Simulated API failure while executing "${operationName}". Disable error simulation and try again.`,
    );
  }
}

/**
 * Simulated API Service (Frontend-only)
 */
export const productsApi = {
  /**
   * Fetches the products list with optional search, category/favorites filter, sorting, and pagination.
   */
  async getProducts({
    category,
    search,
    sortBy,
    page,
    limit,
    favoritesOnly,
    signal,
    delayMs = DEFAULT_DELAY_MS,
  }: GetProductsParams = {}): Promise<PaginatedProductsResponse> {
    await delay(delayMs, signal);
    assertQueryHealthy('getProducts');

    let result = [...PRODUCTS_MOCK];

    if (favoritesOnly) {
      const favoriteIds = new Set(readPersistedFavorites());
      result = result.filter((p) => favoriteIds.has(p.id));
    }

    if (category && category !== 'All' && category !== 'Todos') {
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
    signal?: AbortSignal,
  ): Promise<Product> {
    await delay(delayMs, signal);
    assertQueryHealthy('getProductById');

    const numericId = Number(id);
    const product = PRODUCTS_MOCK.find((p) => p.id === numericId);

    if (!product) {
      throw new ProductNotFoundError(id);
    }

    return product;
  },

  /**
   * Returns list of unique available categories.
   */
  async getCategories(
    delayMs: number = DEFAULT_DELAY_MS,
    signal?: AbortSignal,
  ): Promise<string[]> {
    await delay(delayMs, signal);
    assertQueryHealthy('getCategories');

    return Array.from(new Set(PRODUCTS_MOCK.map((p) => p.category)));
  },

  /**
   * Fetches related products by category excluding current product.
   */
  async getRelatedProducts(
    productId: number | string,
    category: string,
    limit: number = 4,
    delayMs: number = DEFAULT_DELAY_MS,
    signal?: AbortSignal,
  ): Promise<Product[]> {
    await delay(delayMs, signal);
    assertQueryHealthy('getRelatedProducts');

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
    assertQueryHealthy('searchProducts');

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
   */
  async validateStock(
    productId: number | string,
    requestedQuantity: number,
    signal?: AbortSignal,
  ): Promise<StockValidationResult> {
    await delay(150, signal);
    assertQueryHealthy('validateStock');

    const numericId = Number(productId);
    const product = PRODUCTS_MOCK.find((p) => p.id === numericId);

    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    const maxStock = typeof product.stock === 'number' ? product.stock : 99;
    const available = requestedQuantity <= maxStock;

    return {
      available,
      maxStock,
      message: available ? null : `Only ${maxStock} units available in stock.`,
    };
  },

  /**
   * Fetches the user's favorited product IDs from localStorage persistence.
   */
  async getFavorites(
    delayMs: number = 120,
    signal?: AbortSignal,
  ): Promise<number[]> {
    await delay(delayMs, signal);
    assertQueryHealthy('getFavorites');

    return readPersistedFavorites();
  },

  /**
   * Toggles a product ID in persisted favorites. Supports simulated failure
   * for testing React Query optimistic updates and rollback.
   */
  async toggleFavorite(productId: number): Promise<number[]> {
    await delay(280);

    if (apiErrorSimulator.getSnapshot().failFavoritesMutation) {
      throw new Error(
        'Could not update favorite status. Your change has been reverted.',
      );
    }

    const current = readPersistedFavorites();
    const exists = current.includes(productId);
    const updated = exists
      ? current.filter((id) => id !== productId)
      : [...current, productId];

    writePersistedFavorites(updated);
    return updated;
  },
};

export default productsApi;
