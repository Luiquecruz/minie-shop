import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { productsApi } from '../../services/api.js';
import ProductCard from '../../components/ProductCard/ProductCard.jsx';
import './ProductListingPage.css';

export function ProductListingPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Carrega categorias disponíveis na montagem
  useEffect(() => {
    let ignore = false;
    productsApi
      .getCategories(0)
      .then((cats) => {
        if (!ignore) {
          setCategories(['Todos', ...cats]);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar categorias:', err);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Sincroniza produtos com a API simulada
  useEffect(() => {
    let ignore = false;

    productsApi
      .getProducts({
        category: selectedCategory === 'Todos' ? undefined : selectedCategory,
        search: searchTerm,
        sortBy: sortBy || undefined,
        delayMs: 200,
      })
      .then((response) => {
        if (!ignore) {
          setProducts(response.products);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Erro ao buscar produtos:', err);
          setError('Não foi possível carregar os produtos. Tente novamente.');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedCategory, searchTerm, sortBy, retryCount]);

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setIsLoading(true);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setIsLoading(true);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setIsLoading(true);
  };

  const handleResetFilters = () => {
    setSelectedCategory('Todos');
    setSearchTerm('');
    setSortBy('');
    setIsLoading(true);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setRetryCount((c) => c + 1);
  };

  const handleAddToCart = (product) => {
    alert(`"${product.name}" adicionado ao carrinho!`);
  };

  return (
    <main className="plp-container">
      <Helmet>
        <title>Catálogo de Produtos | Mini Shop</title>
        <meta
          name="description"
          content="Explore todos os 30 produtos da nossa Mini Shop. Eletrônicos, vestuário, calçados e decoração com os melhores preços."
        />
      </Helmet>

      {/* Cabeçalho da PLP */}
      <header className="plp-header">
        <span className="plp-header__badge">
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          Coleção Completa
        </span>
        <h1 className="plp-header__title">Catálogo de Produtos</h1>
        <p className="plp-header__subtitle">
          Explore nossa seleção com 30 itens selecionados, preços transparentes e entrega rápida.
        </p>
      </header>

      {/* Barra de Filtros e Ferramentas */}
      <section className="plp-toolbar" aria-label="Filtros de produtos">
        <div className="plp-toolbar__top">
          {/* Campo de Busca */}
          <div className="plp-search">
            <svg
              className="plp-search__icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              className="plp-search__input"
              placeholder="Buscar por nome ou descrição..."
              value={searchTerm}
              onChange={handleSearchChange}
              aria-label="Buscar produtos"
            />
          </div>

          {/* Ordenação */}
          <div className="plp-sort">
            <label htmlFor="plp-sort-select" className="plp-sort__label">
              Ordenar por:
            </label>
            <select
              id="plp-sort-select"
              className="plp-sort__select"
              value={sortBy}
              onChange={handleSortChange}
            >
              <option value="">Padrão (Destaques)</option>
              <option value="price-asc">Menor Preço</option>
              <option value="price-desc">Maior Preço</option>
              <option value="rating">Melhor Avaliados</option>
              <option value="name">Nome (A - Z)</option>
            </select>
          </div>
        </div>

        {/* Chips de Categoria */}
        {categories.length > 0 && (
          <div className="plp-categories" role="tablist" aria-label="Categorias">
            {categories.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  className={`plp-category-chip ${
                    isActive ? 'plp-category-chip--active' : ''
                  }`}
                  onClick={() => handleCategoryChange(category)}
                  aria-pressed={isActive}
                >
                  {category}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Contagem de Resultados */}
      {!isLoading && !error && (
        <div className="plp-results-count">
          Exibindo <strong>{products.length}</strong> {products.length === 1 ? 'produto' : 'produtos'}
          {selectedCategory !== 'Todos' && ` em "${selectedCategory}"`}
          {searchTerm && ` para "${searchTerm}"`}
        </div>
      )}

      {/* Mensagem de Erro */}
      {error && (
        <div className="plp-empty" role="alert">
          <p className="plp-empty__title">Ops! Ocorreu um problema</p>
          <p className="plp-empty__text">{error}</p>
          <button
            type="button"
            className="plp-empty__reset-btn"
            onClick={handleRetry}
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Skeleton Loading */}
      {isLoading && (
        <div className="plp-grid" aria-busy="true" aria-label="Carregando produtos">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="skeleton-card">
              <div className="skeleton-card__img" />
              <div className="skeleton-card__body">
                <div className="skeleton-line skeleton-line--short" />
                <div className="skeleton-line skeleton-line--title" />
                <div className="skeleton-line skeleton-line--full" />
                <div className="skeleton-line skeleton-line--short" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid de Produtos */}
      {!isLoading && !error && products.length > 0 && (
        <div className="plp-grid" id="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      )}

      {/* Estado Vazio (Nenhum produto encontrado) */}
      {!isLoading && !error && products.length === 0 && (
        <div className="plp-empty">
          <svg
            className="plp-empty__icon"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="plp-empty__title">Nenhum produto encontrado</h2>
          <p className="plp-empty__text">
            Tente buscar com outros termos ou selecione uma categoria diferente.
          </p>
          <button
            type="button"
            className="plp-empty__reset-btn"
            onClick={handleResetFilters}
          >
            Limpar Filtros
          </button>
        </div>
      )}
    </main>
  );
}

export default ProductListingPage;
