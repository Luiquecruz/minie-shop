import { PRODUCTS_MOCK } from '../data/products.js';

const DEFAULT_DELAY_MS = 300;

const delay = (ms = DEFAULT_DELAY_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Serviço de API simulada (Frontend-only)
 */
export const productsApi = {
  /**
   * Retorna a lista de produtos com suporte opcional a busca, filtro por categoria, ordenação e paginação.
   * @param {Object} options
   * @param {string} [options.category] - Categoria para filtrar
   * @param {string} [options.search] - Termo de busca (nome ou descrição)
   * @param {string} [options.sortBy] - 'price-asc' | 'price-desc' | 'rating' | 'name'
   * @param {number} [options.page] - Número da página (1-based)
   * @param {number} [options.limit] - Quantidade por página
   * @param {number} [options.delayMs] - Atraso simulado em milissegundos
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
   * Busca um produto específico pelo ID.
   * @param {number|string} id
   * @param {number} [delayMs]
   * @returns {Promise<Object>}
   */
  async getProductById(id, delayMs = DEFAULT_DELAY_MS) {
    await delay(delayMs);
    const numericId = Number(id);
    const product = PRODUCTS_MOCK.find((p) => p.id === numericId);

    if (!product) {
      throw new Error(`Produto com ID ${id} não encontrado.`);
    }

    return product;
  },

  /**
   * Retorna a lista de categorias únicas disponíveis.
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
