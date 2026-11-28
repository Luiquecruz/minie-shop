import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  InstantSearch,
  useConfigure,
  useInfiniteHits,
  useInstantSearch,
  useSearchBox,
} from 'react-instantsearch';
import type { ProductCardDTO, SearchMode } from '@minieshop/contracts';
import { MAX_SEARCH_OFFSET } from '../../domain/repositories/ProductRepository';
import { useCartActions } from '../../hooks/useCart';
import {
  SEARCH_HITS_PER_PAGE,
  SEARCH_INDEX_NAME,
  useStorefrontSearchClient,
  type SearchTelemetry,
  type StorefrontSearchHit,
} from '../../hooks/useSearch';
import { useI18n } from '../../i18n';
import { cn } from '@minieshop/ui/tokens';
import { parseSearchUrlQuery } from '../../utils/searchUrlParams';
import ProductCard from '../../components/ProductCard/ProductCard';

interface RawSearchTelemetryUserData {
  mode?: unknown;
  durationMs?: unknown;
  query?: unknown;
}

function extractTelemetryFromUserData(
  userData: unknown,
): SearchTelemetry | null {
  if (!Array.isArray(userData) || userData.length === 0) {
    return null;
  }
  const first = userData[0] as RawSearchTelemetryUserData | undefined;
  if (!first || typeof first !== 'object') {
    return null;
  }
  if (
    (first.mode === 'hybrid' ||
      first.mode === 'keyword' ||
      first.mode === 'postgres') &&
    typeof first.durationMs === 'number' &&
    typeof first.query === 'string'
  ) {
    return {
      mode: first.mode as SearchMode,
      durationMs: first.durationMs,
      query: first.query,
    };
  }
  return null;
}

function toProductCardDto(hit: StorefrontSearchHit): ProductCardDTO {
  return {
    id: hit.id,
    slug: hit.slug,
    name: hit.name,
    price: hit.price,
    inStock: hit.inStock,
    image: hit.image,
    highlights: hit.highlights,
    categorySlug: hit.categorySlug,
  };
}

interface SearchResultsContentProps {
  urlQuery: string;
}

function SearchResultsContent({ urlQuery }: SearchResultsContentProps) {
  useConfigure({ hitsPerPage: SEARCH_HITS_PER_PAGE });

  const { query, refine } = useSearchBox();
  const { items, results, isLastPage, showMore } =
    useInfiniteHits<StorefrontSearchHit>();
  const { status, error, refresh } = useInstantSearch({ catchError: true });
  const { addToCart } = useCartActions();
  const { t } = useI18n();

  const [favoriteError, setFavoriteError] = useState<Error | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [prevStatus, setPrevStatus] = useState(status);
  const [prevResults, setPrevResults] = useState(results);
  const [prevItemsLength, setPrevItemsLength] = useState(items.length);
  const [prevIsLastPage, setPrevIsLastPage] = useState(isLastPage);

  const hasStatusChanged = prevStatus !== status;
  const hasResultsUpdated =
    prevResults !== results ||
    prevItemsLength !== items.length ||
    prevIsLastPage !== isLastPage;

  if (hasStatusChanged || hasResultsUpdated) {
    setPrevStatus(status);
    setPrevResults(results);
    setPrevItemsLength(items.length);
    setPrevIsLastPage(isLastPage);
    if (status === 'idle' || status === 'error') {
      setIsLoadingMore(false);
    }
  }

  const lastSyncedUrlQueryRef = useRef<string>(urlQuery);

  useEffect(() => {
    if (urlQuery === lastSyncedUrlQueryRef.current) {
      return;
    }
    lastSyncedUrlQueryRef.current = urlQuery;
    refine(urlQuery);
  }, [urlQuery, refine]);

  useEffect(() => {
    if (!favoriteError) return;
    const timer = setTimeout(() => setFavoriteError(null), 4000);
    return () => clearTimeout(timer);
  }, [favoriteError]);

  const handleShowMore = (): void => {
    setIsLoadingMore(true);
    showMore();
  };

  const handleRetry = (): void => {
    if (urlQuery && urlQuery !== query.trim()) {
      refine(urlQuery);
      return;
    }
    refresh();
  };

  const activeQuery = (urlQuery || query).trim();
  const hasActiveQuery = activeQuery.length > 0;
  const isErrorState = hasActiveQuery && status === 'error';
  const isFetching =
    hasActiveQuery && (status === 'loading' || status === 'stalled');
  const settledQuery = results?.query?.trim() ?? '';
  const isQueryMatch = settledQuery === activeQuery;
  const showInitialSkeleton =
    hasActiveQuery && !isErrorState && (!isQueryMatch || (isFetching && items.length === 0));
  const showResultsGrid =
    hasActiveQuery &&
    !isErrorState &&
    !showInitialSkeleton &&
    isQueryMatch &&
    items.length > 0;
  const showEmptyResults =
    hasActiveQuery &&
    !isErrorState &&
    !isFetching &&
    isQueryMatch &&
    items.length === 0;

  const estimatedTotal = results?.nbHits ?? items.length;
  const currentPage = results?.page ?? 0;
  const nextOffset = (currentPage + 1) * SEARCH_HITS_PER_PAGE;
  const isOffsetLimitReached =
    showResultsGrid && !isLastPage && nextOffset > MAX_SEARCH_OFFSET;
  const canShowLoadMore =
    showResultsGrid && !isLastPage && !isOffsetLimitReached;

  const telemetry = import.meta.env.DEV
    ? extractTelemetryFromUserData(results?.userData)
    : null;

  const liveAnnouncement = !hasActiveQuery || isFetching || isErrorState || !isQueryMatch
    ? ''
    : estimatedTotal === 0
      ? t('searchPage.noResultsLive')
      : estimatedTotal === 1
        ? t('searchPage.resultsSingular', { query: activeQuery })
        : t('searchPage.resultsPlural', {
            count: estimatedTotal,
            query: activeQuery,
          });

  const metaTitle = hasActiveQuery
    ? t('searchPage.metaTitleWithQuery', { query: activeQuery })
    : t('searchPage.metaTitle');

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-8 sm:px-6 lg:py-10">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={t('searchPage.metaDescription')} />
      </Helmet>

      {/* Screen-reader live region announcing settled result count */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="search-results-live"
      >
        {liveAnnouncement}
      </div>

      {favoriteError && (
        <div
          className="fixed bottom-6 right-6 z-[var(--z-toast)] flex max-w-md items-center gap-3 rounded-xl border border-danger-border bg-surface px-4 py-3 text-sm font-medium text-danger shadow-card-lg animate-fade-in"
          role="alert"
        >
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

      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center rounded-full border border-brand-border bg-brand-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
          {t('searchPage.badge')}
        </span>
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-fg-heading sm:text-3xl">
          {t('searchPage.heading')}
        </h1>
      </header>

      {hasActiveQuery && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-card-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            {showResultsGrid && (
              <span className="search-page__count text-sm font-medium text-fg">
                {t('searchPage.showingOf', {
                  loaded: items.length,
                  total: estimatedTotal,
                })}{' '}
                <strong className="font-bold text-fg-heading">{activeQuery}</strong>
              </span>
            )}
            {isFetching && !isLoadingMore && (
              <span
                className="plp-sync-pill inline-flex items-center rounded-full border border-brand-border bg-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-brand"
                role="status"
              >
                {t('searchPage.updating')}
              </span>
            )}
          </div>

          {import.meta.env.DEV && telemetry && telemetry.query === activeQuery && (
            <span
              className="rounded-lg border border-border bg-surface-subtle px-2.5 py-1 font-mono text-xs font-medium text-fg-muted"
              data-testid="search-dev-badge"
            >
              {t('searchPage.devBadge', {
                mode: telemetry.mode,
                ms: telemetry.durationMs,
              })}
            </span>
          )}
        </div>
      )}

      {!hasActiveQuery && (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-16 text-center shadow-card-sm">
          <h2 className="m-0 text-lg font-bold text-fg-heading">
            {t('searchPage.emptyPromptTitle')}
          </h2>
          <p className="max-w-md text-sm text-fg-muted">
            {t('searchPage.emptyPromptText')}
          </p>
        </section>
      )}

      {isErrorState && (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border border-danger-border bg-surface px-6 py-12 text-center shadow-card-sm"
          role="alert"
        >
          <p className="text-lg font-bold text-fg-heading">
            {t('searchPage.errorTitle')}
          </p>
          <p className="max-w-md text-sm text-fg-muted">
            {error instanceof Error
              ? error.message
              : t('searchPage.errorFallback')}
          </p>
          <button
            type="button"
            className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-card-sm transition-colors hover:bg-brand-hover"
            onClick={handleRetry}
          >
            {t('searchPage.retry')}
          </button>
        </div>
      )}

      {showInitialSkeleton && (
        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-busy="true"
          aria-label={t('searchPage.loadingResults')}
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

      {showResultsGrid && (
        <>
          <h2 className="sr-only">{t('searchPage.resultsHeading')}</h2>
          <div
            className={cn(
              'grid grid-cols-1 gap-5 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
              isFetching && !isLoadingMore && 'opacity-65',
            )}
            id="search-results-grid"
          >
            {items.map((hit) => (
              <ProductCard
                key={hit.objectID}
                product={toProductCardDto(hit)}
                onAddToCart={addToCart}
                onFavoriteError={setFavoriteError}
              />
            ))}
          </div>

          {canShowLoadMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-border bg-surface px-6 py-3 text-sm font-bold text-fg-heading shadow-card-sm transition-colors hover:border-brand-border hover:bg-surface-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleShowMore}
                disabled={isLoadingMore || isFetching}
                aria-busy={isLoadingMore || isFetching}
              >
                {isLoadingMore || isFetching
                  ? t('searchPage.loadingMore')
                  : t('searchPage.loadMore')}
              </button>
            </div>
          )}

          {isOffsetLimitReached && (
            <p
              className="rounded-xl border border-border bg-surface-subtle px-4 py-3 text-center text-sm font-medium text-fg-muted"
              role="status"
            >
              {t('searchPage.offsetLimitReached')}
            </p>
          )}
        </>
      )}

      {showEmptyResults && (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-14 text-center shadow-card-sm">
          <h2 className="m-0 text-lg font-bold text-fg-heading">
            {t('searchPage.emptyResultsTitle')}{' '}
            <strong className="text-brand">{activeQuery}</strong>
          </h2>
          <p className="max-w-md text-sm text-fg-muted">
            {t('searchPage.emptyResultsTip')}
          </p>
          <Link
            to="/"
            className="mt-2 inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-card-sm transition-colors hover:bg-brand-hover"
          >
            {t('searchPage.backToCatalog')}
          </Link>
        </section>
      )}
    </div>
  );
}

/**
 * Dedicated lazy-loaded Search Results Page (/search) backed by React InstantSearch
 * (`useSearchBox`, `useInfiniteHits`, `useInstantSearch`) and `ProductRepository`.
 * Driven by the `?q=` URL parameter updated from the unified global header SearchBar.
 */
export function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const urlQuery = useMemo(
    () => parseSearchUrlQuery(searchParams),
    [searchParams],
  );
  const [initialUrlQuery] = useState<string>(() => urlQuery);
  const searchClient = useStorefrontSearchClient();

  return (
    <InstantSearch
      searchClient={searchClient}
      indexName={SEARCH_INDEX_NAME}
      initialUiState={{
        [SEARCH_INDEX_NAME]: {
          query: initialUrlQuery,
        },
      }}
      future={{ preserveSharedStateOnUnmount: true }}
    >
      <SearchResultsContent urlQuery={urlQuery} />
    </InstantSearch>
  );
}

export default SearchResultsPage;
