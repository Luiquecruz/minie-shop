import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import type {
  CategoryDTO,
  FacetsDTO,
  ProductCardDTO,
  ProductSort,
} from '@minieshop/contracts';
import { useCart } from '../../hooks/useCart';
import {
  useCategoriesQuery,
  useFacetsQuery,
  useProductsQuery,
} from '../../hooks/useProducts';
import { t } from '../../i18n';
import {
  parseCatalogUrlParams,
  serializeCatalogUrlParams,
  type CatalogUrlState,
} from '../../utils/catalogUrlParams';
import CatalogFilters from '../../components/CatalogFilters/CatalogFilters';
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

function deriveTotalFromFacets(
  facets: FacetsDTO | undefined,
  categories: CategoryDTO[],
  activeCategorySlug: string | undefined,
): number | null {
  if (!facets) return null;
  if (facets.categories.length === 0) return 0;

  if (activeCategorySlug) {
    const match = facets.categories.find(
      (cat) => cat.slug === activeCategorySlug,
    );
    return match ? match.count : 0;
  }

  if (categories.length === 0) return null;
  const rootSlugs = new Set(categories.map((cat) => cat.slug));
  let total = 0;
  for (const facetCat of facets.categories) {
    if (rootSlugs.has(facetCat.slug)) {
      total += facetCat.count;
    }
  }
  return total;
}

export function ProductListingPage() {
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlState = useMemo(
    () => parseCatalogUrlParams(searchParams),
    [searchParams],
  );

  const [favoriteError, setFavoriteError] = useState<Error | null>(null);

  const categoriesQuery = useCategoriesQuery();

  const facetFilters = useMemo(
    () => ({
      category: urlState.category,
      q: urlState.q,
      minPrice: urlState.minPrice,
      maxPrice: urlState.maxPrice,
      inStock: urlState.inStock,
      attributes: urlState.attributes,
      numericAttributes: urlState.numericAttributes,
    }),
    [
      urlState.category,
      urlState.q,
      urlState.minPrice,
      urlState.maxPrice,
      urlState.inStock,
      urlState.attributes,
      urlState.numericAttributes,
    ],
  );

  const listFilters = useMemo(
    () => ({
      ...facetFilters,
      sort: urlState.sort,
      limit: PAGE_SIZE,
    }),
    [facetFilters, urlState.sort],
  );

  const productsQuery = useProductsQuery(listFilters);
  const facetsQuery = useFacetsQuery(facetFilters);

  const sortOptions = useMemo<DropdownOption<ProductSort>[]>(() => {
    if (urlState.q) {
      return [
        { value: 'relevance', label: t('plp.sort.relevance') },
        ...BASE_SORT_OPTIONS,
      ];
    }
    return BASE_SORT_OPTIONS;
  }, [urlState.q]);

  const products = useMemo<ProductCardDTO[]>(
    () => productsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [productsQuery.data],
  );

  const rootCategories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );
  const derivedTotal = useMemo(
    () => deriveTotalFromFacets(facetsQuery.data, rootCategories, urlState.category),
    [facetsQuery.data, rootCategories, urlState.category],
  );

  // Auto-dismiss favorite rollback notice after 4 seconds
  useEffect(() => {
    if (!favoriteError) return;
    const timer = setTimeout(() => {
      setFavoriteError(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [favoriteError]);

  const handleUpdateUrlState = useCallback(
    (
      updater: (prev: CatalogUrlState) => CatalogUrlState,
      options?: { replace?: boolean },
    ): void => {
      setSearchParams(
        (prevParams) => {
          const current = parseCatalogUrlParams(prevParams);
          const next = updater(current);
          return serializeCatalogUrlParams(next);
        },
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  const handleSortChange = (newValue: ProductSort): void => {
    if (newValue === urlState.sort) return;
    handleUpdateUrlState((prev) => ({ ...prev, sort: newValue }), {
      replace: false,
    });
  };

  const handleResetFilters = useCallback((): void => {
    setSearchParams({}, { replace: false });
  }, [setSearchParams]);

  const handleAddToCart = (product: ProductCardDTO): void => {
    addToCart(product);
  };

  const showInitialSkeleton = productsQuery.isPending;
  const showErrorState = productsQuery.isError;
  const showResults = !showInitialSkeleton && !showErrorState;
  const isTransitioningFilters =
    productsQuery.isPlaceholderData && productsQuery.isFetching;

  const liveStatusText = !showResults
    ? ''
    : derivedTotal !== null
      ? t('plp.resultsUpdatedWithCount', { count: derivedTotal })
      : t('plp.resultsUpdated');

  return (
    <main className="plp-container">
      <Helmet>
        <title>{t('plp.metaTitle')}</title>
        <meta name="description" content={t('plp.metaDescription')} />
      </Helmet>

      {/* Screen-reader live region announcing filter/search result updates */}
      <div className="plp-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatusText}
      </div>

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

      <div className="plp-layout">
        <CatalogFilters
          categories={rootCategories}
          facets={facetsQuery.data}
          state={urlState}
          onUpdate={handleUpdateUrlState}
          onClearAll={handleResetFilters}
        />

        <div className="plp-main">
          {/* Top toolbar: Results summary + Sort Dropdown */}
          <section className="plp-toolbar" aria-label={t('plp.sortAria')}>
            <div className="plp-results-row">
              {showResults && (
                <div className="plp-results-count">
                  {derivedTotal !== null
                    ? t('plp.showingLoadedOf', {
                        loaded: products.length,
                        total: derivedTotal,
                      })
                    : t('plp.showingLoaded', { count: products.length })}
                  {urlState.category && ` (${urlState.category})`}
                  {urlState.q && ` — "${urlState.q}"`}
                </div>
              )}
              {isTransitioningFilters && (
                <span className="plp-sync-pill" role="status">
                  {t('plp.updating')}
                </span>
              )}
            </div>

            <div className="plp-sort">
              <span className="plp-sort__label">{t('plp.sortLabel')}</span>
              <Dropdown<ProductSort>
                options={sortOptions}
                value={urlState.sort}
                onChange={handleSortChange}
                ariaLabel={t('plp.sortAria')}
                align="right"
              />
            </div>
          </section>

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
                  if (facetsQuery.isError) {
                    void facetsQuery.refetch();
                  }
                  if (categoriesQuery.isError) {
                    void categoriesQuery.refetch();
                  }
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
              {Array.from({ length: 6 }).map((_, index) => (
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
        </div>
      </div>
    </main>
  );
}

export default ProductListingPage;
