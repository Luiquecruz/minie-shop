import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import type { ProductCardDTO, ProductSort } from '@minieshop/contracts';
import { useCart } from '../../hooks/useCart';
import { useCategoriesQuery, useProductsQuery } from '../../hooks/useProducts';
import { t } from '../../i18n';
import ProductCard from '../../components/ProductCard/ProductCard';
import Dropdown, { type DropdownOption } from '../../components/Dropdown/Dropdown';
import './ProductListingPage.css';

const PAGE_SIZE = 12;

const BASE_SORT_OPTIONS: DropdownOption<ProductSort>[] = [
  { value: 'newest', label: t('plp.sort.newest') },
  { value: 'price_asc', label: t('plp.sort.price_asc') },
  { value: 'price_desc', label: t('plp.sort.price_desc') },
  { value: 'name_asc', label: t('plp.sort.name_asc') },
];

const VALID_SORT_VALUES = new Set<ProductSort>([
  'newest',
  'price_asc',
  'price_desc',
  'name_asc',
  'relevance',
]);

function parseSortParam(raw: string | null, hasQuery: boolean): ProductSort {
  if (raw && VALID_SORT_VALUES.has(raw as ProductSort)) {
    if (raw === 'relevance' && !hasQuery) {
      return 'newest';
    }
    return raw as ProductSort;
  }
  return 'newest';
}

export function ProductListingPage() {
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedCategory = searchParams.get('category') || '';
  const queryTerm = searchParams.get('q')?.trim() || '';
  const sortBy = parseSortParam(searchParams.get('sort'), queryTerm.length > 0);

  const [favoriteError, setFavoriteError] = useState<Error | null>(null);

  const categoriesQuery = useCategoriesQuery();

  const queryFilters = useMemo(
    () => ({
      category: selectedCategory || undefined,
      q: queryTerm || undefined,
      sort: sortBy,
      limit: PAGE_SIZE,
    }),
    [selectedCategory, queryTerm, sortBy],
  );

  const productsQuery = useProductsQuery(queryFilters);

  const sortOptions = useMemo<DropdownOption<ProductSort>[]>(() => {
    if (queryTerm.length > 0) {
      return [
        { value: 'relevance', label: t('plp.sort.relevance') },
        ...BASE_SORT_OPTIONS,
      ];
    }
    return BASE_SORT_OPTIONS;
  }, [queryTerm]);

  const products = useMemo<ProductCardDTO[]>(
    () => productsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [productsQuery.data],
  );

  // Auto-dismiss favorite rollback notice after 4 seconds
  useEffect(() => {
    if (!favoriteError) return;
    const timer = setTimeout(() => {
      setFavoriteError(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [favoriteError]);

  const handleCategoryChange = (categorySlug: string): void => {
    if (categorySlug === selectedCategory) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!categorySlug) {
        next.delete('category');
      } else {
        next.set('category', categorySlug);
      }
      return next;
    });
  };

  const handleSortChange = (newValue: ProductSort): void => {
    if (newValue === sortBy) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newValue === 'newest') {
        next.delete('sort');
      } else {
        next.set('sort', newValue);
      }
      return next;
    });
  };

  const handleResetFilters = (): void => {
    setSearchParams({});
  };

  const handleAddToCart = (product: ProductCardDTO): void => {
    addToCart(product);
  };

  const showInitialSkeleton = productsQuery.isPending;
  const showErrorState = productsQuery.isError;
  const showResults = !showInitialSkeleton && !showErrorState;
  const isTransitioningFilters =
    productsQuery.isPlaceholderData && productsQuery.isFetching;

  const rootCategories = categoriesQuery.data ?? [];

  return (
    <main className="plp-container">
      <Helmet>
        <title>{t('plp.metaTitle')}</title>
        <meta name="description" content={t('plp.metaDescription')} />
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
            onClick={() => setFavoriteError(null)}
            aria-label={t('plp.dismissNotification')}
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
          {t('plp.badge')}
        </span>
        <h1 className="plp-header__title">{t('plp.title')}</h1>
        <p className="plp-header__subtitle">{t('plp.subtitle')}</p>
      </header>

      {/* Filters Toolbar */}
      <section className="plp-toolbar" aria-label={t('filters.formAria')}>
        <div className="plp-categories" role="tablist" aria-label={t('filters.categoriesLegend')}>
          <button
            type="button"
            className={`plp-category-chip ${
              selectedCategory === '' ? 'plp-category-chip--active' : ''
            }`}
            onClick={() => handleCategoryChange('')}
            aria-pressed={selectedCategory === ''}
          >
            <span>{t('filters.allCategories')}</span>
          </button>

          {rootCategories.map((category) => {
            const isActive = selectedCategory === category.slug;
            return (
              <button
                key={category.id}
                type="button"
                className={`plp-category-chip ${
                  isActive ? 'plp-category-chip--active' : ''
                }`}
                onClick={() => handleCategoryChange(category.slug)}
                aria-pressed={isActive}
              >
                <span>{category.name}</span>
                <span className="plp-category-chip__count">
                  {category.productCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort Dropdown */}
        <div className="plp-sort">
          <span className="plp-sort__label">{t('plp.sortLabel')}</span>
          <Dropdown<ProductSort>
            options={sortOptions}
            value={sortBy}
            onChange={handleSortChange}
            ariaLabel={t('plp.sortAria')}
            align="right"
          />
        </div>
      </section>

      {/* Results Count */}
      {showResults && (
        <div className="plp-results-row">
          <div className="plp-results-count">
            {t('plp.showingLoaded', { count: products.length })}
            {selectedCategory && ` (${selectedCategory})`}
            {queryTerm && ` — "${queryTerm}"`}
          </div>
          {isTransitioningFilters && (
            <span className="plp-sync-pill" role="status" aria-live="polite">
              {t('plp.updating')}
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
          <p className="plp-empty__title">{t('plp.errorTitle')}</p>
          <p className="plp-empty__text">
            {productsQuery.error instanceof Error
              ? productsQuery.error.message
              : t('plp.errorFallback')}
          </p>
          <button
            type="button"
            className="plp-empty__reset-btn"
            onClick={() => {
              void productsQuery.refetch();
            }}
            disabled={productsQuery.isFetching}
          >
            {productsQuery.isFetching ? t('plp.retrying') : t('plp.retry')}
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

      {/* Products Grid (kept visible during filter transitions via keepPreviousData) */}
      {showResults && products.length > 0 && (
        <>
          <div
            className={`plp-grid ${
              isTransitioningFilters ? 'plp-grid--fetching' : ''
            }`}
            id="product-grid"
          >
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                onFavoriteError={setFavoriteError}
              />
            ))}
          </div>

          {productsQuery.hasNextPage && (
            <div className="plp-load-more">
              <button
                type="button"
                className="plp-load-more__btn"
                onClick={() => {
                  void productsQuery.fetchNextPage();
                }}
                disabled={productsQuery.isFetchingNextPage}
                aria-busy={productsQuery.isFetchingNextPage}
              >
                {productsQuery.isFetchingNextPage
                  ? t('plp.loadingMore')
                  : t('plp.loadMore')}
              </button>
            </div>
          )}
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
          <h2 className="plp-empty__title">{t('plp.emptyTitle')}</h2>
          <p className="plp-empty__text">{t('plp.emptyText')}</p>
          <button
            type="button"
            className="plp-empty__reset-btn"
            onClick={handleResetFilters}
          >
            {t('plp.clearFilters')}
          </button>
        </div>
      )}
    </main>
  );
}

export default ProductListingPage;
