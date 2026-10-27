import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useCart } from '../../hooks/useCart.js';
import { productsApi } from '../../services/api.js';
import ProductCard from '../../components/ProductCard/ProductCard.jsx';
import Dropdown from '../../components/Dropdown/Dropdown.jsx';
import './ProductListingPage.css';

const SORT_OPTIONS = [
  { value: '', label: 'Default (Featured)' },
  { value: 'price-asc', label: 'Lowest Price' },
  { value: 'price-desc', label: 'Highest Price' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'name', label: 'Name (A - Z)' },
];

export function ProductListingPage() {
  const { addToCart } = useCart();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Load available categories on mount
  useEffect(() => {
    let ignore = false;
    productsApi
      .getCategories(0)
      .then((cats) => {
        if (!ignore) {
          setCategories(['All', ...cats]);
        }
      })
      .catch((err) => {
        console.error('Failed to load categories:', err);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Synchronize products from simulated API
  useEffect(() => {
    let ignore = false;

    productsApi
      .getProducts({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
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
          console.error('Failed to load products:', err);
          setError('Could not load products. Please try again.');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedCategory, sortBy, retryCount]);

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setIsLoading(true);
  };

  const handleSortChange = (newValue) => {
    const value =
      typeof newValue === 'object' && newValue?.target
        ? newValue.target.value
        : newValue;
    setSortBy(value);
    setIsLoading(true);
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSortBy('');
    setIsLoading(true);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setRetryCount((c) => c + 1);
  };

  const handleAddToCart = (product) => {
    addToCart(product);
  };

  return (
    <main className="plp-container">
      <Helmet>
        <title>Product Catalog | Minie Shop</title>
        <meta
          name="description"
          content="Explore all 30 products in Minie Shop. Electronics, clothing, footwear, and home decor at great prices."
        />
      </Helmet>

      {/* PLP Header */}
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
          Complete Collection
        </span>
        <h1 className="plp-header__title">Product Catalog</h1>
        <p className="plp-header__subtitle">
          Explore our handpicked collection of 30 items, transparent pricing, and fast delivery.
        </p>
      </header>

      {/* Filters Toolbar: Categories Badges + Sort in a single line */}
      <section className="plp-toolbar" aria-label="Product filters">
        {/* Category Chips */}
        {categories.length > 0 && (
          <div className="plp-categories" role="tablist" aria-label="Categories">
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

        {/* Sort Dropdown */}
        <div className="plp-sort">
          <span className="plp-sort__label">Sort by:</span>
          <Dropdown
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={handleSortChange}
            ariaLabel="Sort products"
            align="right"
          />
        </div>
      </section>

      {/* Results Count */}
      {!isLoading && !error && (
        <div className="plp-results-count">
          Showing <strong>{products.length}</strong> {products.length === 1 ? 'product' : 'products'}
          {selectedCategory !== 'All' && ` in "${selectedCategory}"`}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="plp-empty" role="alert">
          <p className="plp-empty__title">Oops! Something went wrong</p>
          <p className="plp-empty__text">{error}</p>
          <button
            type="button"
            className="plp-empty__reset-btn"
            onClick={handleRetry}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Skeleton Loading */}
      {isLoading && (
        <div className="plp-grid" aria-busy="true" aria-label="Loading products">
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

      {/* Products Grid */}
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

      {/* Empty State */}
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
          <h2 className="plp-empty__title">No products found</h2>
          <p className="plp-empty__text">
            Try searching with different terms or selecting another category.
          </p>
          <button
            type="button"
            className="plp-empty__reset-btn"
            onClick={handleResetFilters}
          >
            Reset Filters
          </button>
        </div>
      )}
    </main>
  );
}

export default ProductListingPage;
