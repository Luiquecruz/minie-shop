import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import type {
  CategoryDTO,
  FacetsDTO,
  ProductCardDTO,
  ProductSort,
} from '@minieshop/contracts';
import { useCartActions } from '../../hooks/useCart';
import { useFavoritesQuery } from '../../hooks/useFavorites';
import {
  useCategoriesQuery,
  useFacetsQuery,
  useProductsQuery,
} from '../../hooks/useProducts';
import { useI18n } from '../../i18n';
import { cn } from '@minieshop/ui/tokens';
import {
  parseCatalogUrlParams,
  serializeCatalogUrlParams,
  type CatalogUrlState,
} from '../../utils/catalogUrlParams';
import CatalogFilters from '../../components/CatalogFilters/CatalogFilters';
import ProductCard from '../../components/ProductCard/ProductCard';
import Dropdown, { type DropdownOption } from '../../components/Dropdown/Dropdown';

const PAGE_SIZE = 12;

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
  const { addToCart } = useCartActions();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlState = useMemo(
    () => parseCatalogUrlParams(searchParams),
    [searchParams],
  );

  const [favoriteError, setFavoriteError] = useState<Error | null>(null);

  const categoriesQuery = useCategoriesQuery();
  // Prefetch favorites in parallel with products/categories/facets to avoid a ProductCard mount waterfall
  useFavoritesQuery();

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
    const base: DropdownOption<ProductSort>[] = [
      { value: 'newest', label: t('plp.sort.newest') },
      { value: 'price_asc', label: t('plp.sort.price_asc') },
      { value: 'price_desc', label: t('plp.sort.price_desc') },
      { value: 'name_asc', label: t('plp.sort.name_asc') },
    ];
    if (urlState.q) {
      return [{ value: 'relevance', label: t('plp.sort.relevance') }, ...base];
    }
    return base;
  }, [urlState.q, t]);

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
  const showErrorState =
    productsQuery.isError && !productsQuery.isFetchNextPageError;
  const showResults = !showInitialSkeleton && !showErrorState;
  const isTransitioningFilters =
    productsQuery.isPlaceholderData && productsQuery.isFetching;

  const liveStatusText = !showResults
    ? ''
    : derivedTotal !== null
      ? t('plp.resultsUpdatedWithCount', { count: derivedTotal })
      : t('plp.resultsUpdated');

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
      <Helmet>
        <title>{t('plp.metaTitle')}</title>
        <meta name="description" content={t('plp.metaDescription')} />
      </Helmet>

      {/* Screen-reader live region announcing filter/search result updates */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatusText}
      </div>

      {/* Optimistic rollback error banner */}
      {favoriteError && (
        <div
          className="plp-toast--error fixed bottom-6 right-6 z-[var(--z-toast)] flex max-w-md items-center gap-3 rounded-xl border border-danger-border bg-surface px-4 py-3 text-sm font-medium text-danger shadow-card-lg animate-fade-in"
          role="alert"
        >
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
          <span className="flex-1">{favoriteError.message}</span>
          <button
            type="button"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-fg-muted hover:bg-surface-chip hover:text-fg-heading"
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
      <header className="mb-8 flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand-border bg-brand-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
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
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-fg-heading sm:text-3xl">
          {t('plp.title')}
        </h1>
        <p className="max-w-2xl text-sm text-fg-muted sm:text-base">
          {t('plp.subtitle')}
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-8">
        <CatalogFilters
          categories={rootCategories}
          facets={facetsQuery.data}
          state={urlState}
          onUpdate={handleUpdateUrlState}
          onClearAll={handleResetFilters}
        />

        <div className="flex min-w-0 flex-col gap-6">
          {/* Top toolbar: Results summary + Sort Dropdown */}
          <section
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-card-sm"
            aria-label={t('plp.sortAria')}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              {showResults && (
                <div className="text-sm font-medium text-fg">
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
                <span
                  className="plp-sync-pill inline-flex items-center rounded-full border border-brand-border bg-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-brand"
                  role="status"
                >
                  {t('plp.updating')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('plp.sortLabel')}
              </span>
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
            <div
              className="flex flex-col items-center gap-3 rounded-2xl border border-danger-border bg-surface px-6 py-12 text-center shadow-card-sm"
              role="alert"
            >
              <svg
                className="h-12 w-12 text-danger"
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
              <p className="text-lg font-bold text-fg-heading">{t('plp.errorTitle')}</p>
              <p className="max-w-md text-sm text-fg-muted">
                {productsQuery.error instanceof Error
                  ? productsQuery.error.message
                  : t('plp.errorFallback')}
              </p>
              <button
                type="button"
                className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-card-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
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
            <div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
              aria-busy="true"
              aria-label={t('plp.loadingProducts')}
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="skeleton-card overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  <div className="skeleton-shimmer aspect-[4/3] w-full" />
                  <div className="flex flex-col gap-3 p-4">
                    <div className="skeleton-shimmer h-3.5 w-1/3 rounded-md" />
                    <div className="skeleton-shimmer h-5 w-4/5 rounded-md" />
                    <div className="skeleton-shimmer h-4 w-full rounded-md" />
                    <div className="skeleton-shimmer h-4 w-2/5 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Products Grid (kept visible during filter transitions via keepPreviousData) */}
          {showResults && products.length > 0 && (
            <>
              <div
                className={cn(
                  'grid grid-cols-1 gap-5 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3',
                  isTransitioningFilters && 'opacity-65',
                )}
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
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-border bg-surface px-6 py-3 text-sm font-bold text-fg-heading shadow-card-sm transition-colors hover:border-brand-border hover:bg-surface-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-14 text-center shadow-card-sm">
              <svg
                className="h-12 w-12 text-fg-muted"
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
              <h2 className="m-0 text-lg font-bold text-fg-heading">
                {t('plp.emptyTitle')}
              </h2>
              <p className="max-w-md text-sm text-fg-muted">{t('plp.emptyText')}</p>
              <button
                type="button"
                className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-card-sm transition-colors hover:bg-brand-hover"
                onClick={handleResetFilters}
              >
                {t('plp.clearFilters')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductListingPage;
