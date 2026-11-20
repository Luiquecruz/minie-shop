import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import type { Product, ProductSortOption } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';
import { useCategoriesQuery, useProductsQuery } from '../../hooks/useProducts';
import ProductCard from '../../components/ProductCard/ProductCard';
import Dropdown, { type DropdownOption } from '../../components/Dropdown/Dropdown';
import Pagination from '../../components/Pagination/Pagination';
import './ProductListingPage.css';

const PAGE_SIZE = 12;
const FAVORITES_FILTER = 'Favorites';

const SORT_OPTIONS: DropdownOption<ProductSortOption>[] = [
  { value: '', label: 'Default (Featured)' },
  { value: 'price-asc', label: 'Lowest Price' },
  { value: 'price-desc', label: 'Highest Price' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'name', label: 'Name (A - Z)' },
];

const VALID_SORT_VALUES = new Set<ProductSortOption>([
  '',
  'price-asc',
  'price-desc',
  'rating',
  'name',
]);

function parseSortParam(raw: string | null): ProductSortOption {
  if (raw && VALID_SORT_VALUES.has(raw as ProductSortOption)) {
    return raw as ProductSortOption;
  }
  return '';
}

function parsePageParam(raw: string | null): number {
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 1) {
    return parsed;
  }
  return 1;
}

export function ProductListingPage() {
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedCategory = searchParams.get('category') || 'All';
  const sortBy = parseSortParam(searchParams.get('sort'));
  const currentPage = parsePageParam(searchParams.get('page'));
  const isFavoritesFilter = selectedCategory === FAVORITES_FILTER;

  const {
    favoritesCount,
    error: favoriteError,
    resetError: resetFavoriteError,
  } = useFavorites();

  const categoriesQuery = useCategoriesQuery();

  const queryFilters = useMemo(
    () => ({
      category:
        selectedCategory === 'All' || isFavoritesFilter
          ? undefined
          : selectedCategory,
      sortBy: sortBy || undefined,
      page: currentPage,
      limit: PAGE_SIZE,
      favoritesOnly: isFavoritesFilter || undefined,
    }),
    [selectedCategory, isFavoritesFilter, sortBy, currentPage],
  );

  const productsQuery = useProductsQuery(queryFilters);

  const categories = useMemo(() => {
    const rawCats = categoriesQuery.data ?? [];
    return ['All', FAVORITES_FILTER, ...rawCats];
  }, [categoriesQuery.data]);

  const products = productsQuery.data?.products ?? [];
  const totalProducts = productsQuery.data?.total ?? 0;
  const totalPages = productsQuery.data?.totalPages ?? 1;

  // Auto-dismiss favorite rollback notice after 4 seconds
  useEffect(() => {
    if (!favoriteError) return;
    const timer = setTimeout(() => {
      resetFavoriteError();
    }, 4000);
    return () => clearTimeout(timer);
  }, [favoriteError, resetFavoriteError]);

  // Clamp out-of-bounds page parameter when filtered results shrink
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (totalPages <= 1) {
            next.delete('page');
          } else {
            next.set('page', String(totalPages));
          }
          return next;
        },
        { replace: true },
      );
    }
  }, [totalPages, currentPage, setSearchParams]);

  const updateFilters = (updates: {
    category?: string;
    sort?: ProductSortOption;
    page?: number;
  }): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);

      if (updates.category !== undefined) {
        if (updates.category === 'All') {
          next.delete('category');
        } else {
          next.set('category', updates.category);
        }
      }

      if (updates.sort !== undefined) {
        if (updates.sort === '') {
          next.delete('sort');
        } else {
          next.set('sort', updates.sort);
        }
      }

      if (updates.page !== undefined) {
        if (updates.page <= 1) {
          next.delete('page');
        } else {
          next.set('page', String(updates.page));
        }
      }

      return next;
    });
  };

  const handleCategoryChange = (category: string): void => {
    if (category === selectedCategory) return;
    updateFilters({ category, page: 1 });
  };

  const handleSortChange = (newValue: ProductSortOption): void => {
    if (newValue === sortBy) return;
    updateFilters({ sort: newValue, page: 1 });
  };

  const handlePageChange = (nextPage: number): void => {
    updateFilters({ page: nextPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetFilters = (): void => {
    setSearchParams({});
  };

  const handleAddToCart = (product: Product): void => {
    addToCart(product);
  };

  const showInitialSkeleton = productsQuery.isPending;
  const showErrorState = productsQuery.isError;
  const showResults = !showInitialSkeleton && !showErrorState;
  const isTransitioningPage =
    productsQuery.isPlaceholderData && productsQuery.isFetching;

  return (
    <main className="plp-container">
      <Helmet>
        <title>Product Catalog | Minie Shop</title>
        <meta
          name="description"
          content="Explore all 30 products in Minie Shop. Electronics, clothing, footwear, and home decor at great prices."
        />
      </Helmet>

      {/* Optimistic rollback error banner */}
      {favoriteError && (
        <div className="plp-toast plp-toast--error" role="alert">
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span>{favoriteError.message}</span>
          <button
            type="button"
            className="plp-toast__close"
            onClick={resetFavoriteError}
            aria-label="Dismiss notification"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

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
        <div className="plp-categories" role="tablist" aria-label="Categories">
          {categories.map((category) => {
            const isActive = selectedCategory === category;
            const isFavChip = category === FAVORITES_FILTER;
            return (
              <button
                key={category}
                type="button"
                className={`plp-category-chip ${
                  isActive ? 'plp-category-chip--active' : ''
                } ${isFavChip ? 'plp-category-chip--favorites' : ''}`}
                onClick={() => handleCategoryChange(category)}
                aria-pressed={isActive}
              >
                {isFavChip && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={isActive ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                    />
                  </svg>
                )}
                <span>{category}</span>
                {isFavChip && favoritesCount > 0 && (
                  <span className="plp-category-chip__count">
                    {favoritesCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sort Dropdown */}
        <div className="plp-sort">
          <span className="plp-sort__label">Sort by:</span>
          <Dropdown<ProductSortOption>
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={handleSortChange}
            ariaLabel="Sort products"
            align="right"
          />
        </div>
      </section>

      {/* Results Count */}
      {showResults && (
        <div className="plp-results-row">
          <div className="plp-results-count">
            Showing <strong>{products.length}</strong> of{' '}
            <strong>{totalProducts}</strong>{' '}
            {totalProducts === 1 ? 'product' : 'products'}
            {selectedCategory !== 'All' && ` in "${selectedCategory}"`}
            {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
          </div>
          {isTransitioningPage && (
            <span className="plp-sync-pill" role="status" aria-live="polite">
              Loading page...
            </span>
          )}
        </div>
      )}

      {/* Error State with Retry */}
      {showErrorState && (
        <div className="plp-empty" role="alert">
          <svg
            className="plp-empty__icon plp-empty__icon--error"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="plp-empty__title">Oops! Something went wrong</p>
          <p className="plp-empty__text">
            {productsQuery.error instanceof Error
              ? productsQuery.error.message
              : 'Could not load products. Please try again.'}
          </p>
          <button
            type="button"
            className="plp-empty__reset-btn"
            onClick={() => {
              void productsQuery.refetch();
            }}
            disabled={productsQuery.isFetching}
          >
            {productsQuery.isFetching ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      )}

      {/* Initial Skeleton Loading */}
      {showInitialSkeleton && (
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

      {/* Products Grid (kept visible during page switches via keepPreviousData) */}
      {showResults && products.length > 0 && (
        <>
          <div
            className={`plp-grid ${isTransitioningPage ? 'plp-grid--fetching' : ''}`}
            id="product-grid"
          >
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isFetching={isTransitioningPage}
          />
        </>
      )}

      {/* Empty State */}
      {showResults && products.length === 0 && (
        <div className="plp-empty">
          <svg
            className="plp-empty__icon"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="plp-empty__title">
            {isFavoritesFilter
              ? 'No favorite products yet'
              : 'No products found'}
          </h2>
          <p className="plp-empty__text">
            {isFavoritesFilter
              ? 'Click the heart icon on any product card to save items here.'
              : 'Try searching with different terms or selecting another category.'}
          </p>
          <button
            type="button"
            className="plp-empty__reset-btn"
            onClick={handleResetFilters}
          >
            {isFavoritesFilter ? 'Browse All Products' : 'Reset Filters'}
          </button>
        </div>
      )}
    </main>
  );
}

export default ProductListingPage;
