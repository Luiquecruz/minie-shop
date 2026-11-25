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
import { useCart } from '../../hooks/useCart';
import { useProductRepository } from '../../hooks/useProductRepository';
import {
  createStorefrontSearchClient,
  SEARCH_HITS_PER_PAGE,
  SEARCH_INDEX_NAME,
  type SearchTelemetry,
  type StorefrontSearchHit,
} from '../../infrastructure/search/instantSearchAdapter';
import { useI18n } from '../../i18n';
import { parseSearchUrlQuery } from '../../utils/searchUrlParams';
import ProductCard from '../../components/ProductCard/ProductCard';
import './SearchResultsPage.css';

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
  const { addToCart } = useCart();
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

  // Sync URL navigation (global SearchBar submits, shared links, Back/Forward) into InstantSearch
  useEffect(() => {
    if (urlQuery === lastSyncedUrlQueryRef.current) {
      return;
    }
    lastSyncedUrlQueryRef.current = urlQuery;
    refine(urlQuery);
  }, [urlQuery, refine]);

  // Auto-dismiss favorite rollback notice
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
      // InstantSearch's index widget rolls helper.state back to lastValidSearchParameters
      // when a request fails; re-refine with the active URL query to retry it.
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
    <main className="search-page">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={t('searchPage.metaDescription')} />
      </Helmet>

      {/* Screen-reader live region announcing settled result count */}
      <div
        className="visually-hidden"
        aria-live="polite"
        aria-atomic="true"
        data-testid="search-results-live"
      >
        {liveAnnouncement}
      </div>

      {favoriteError && (
        <div className="plp-toast plp-toast--error" role="alert">
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

      <header className="search-page__header">
        <span className="plp-header__badge">{t('searchPage.badge')}</span>
        <h1 className="search-page__title">{t('searchPage.heading')}</h1>
      </header>

      {hasActiveQuery && (
        <div className="search-page__toolbar">
          <div className="search-page__summary">
            {showResultsGrid && (
              <span className="search-page__count">
                {t('searchPage.showingOf', {
                  loaded: items.length,
                  total: estimatedTotal,
                })}{' '}
                <strong>{activeQuery}</strong>
              </span>
            )}
            {isFetching && !isLoadingMore && (
              <span className="plp-sync-pill" role="status">
                {t('searchPage.updating')}
              </span>
            )}
          </div>

          {import.meta.env.DEV && telemetry && telemetry.query === activeQuery && (
            <span
              className="search-page__dev-badge"
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
        <section className="plp-empty search-page__prompt">
          <h2 className="plp-empty__title">{t('searchPage.emptyPromptTitle')}</h2>
          <p className="plp-empty__text">{t('searchPage.emptyPromptText')}</p>
        </section>
      )}

      {isErrorState && (
        <div className="plp-empty" role="alert">
          <p className="plp-empty__title">{t('searchPage.errorTitle')}</p>
          <p className="plp-empty__text">
            {error instanceof Error
              ? error.message
              : t('searchPage.errorFallback')}
          </p>
          <button
            type="button"
            className="plp-empty__reset-btn"
            onClick={handleRetry}
          >
            {t('searchPage.retry')}
          </button>
        </div>
      )}

      {showInitialSkeleton && (
        <div
          className="plp-grid"
          aria-busy="true"
          aria-label={t('searchPage.loadingResults')}
        >
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

      {showResultsGrid && (
        <>
          <h2 className="visually-hidden">{t('searchPage.resultsHeading')}</h2>
          <div
            className={`plp-grid ${
              isFetching && !isLoadingMore ? 'plp-grid--fetching' : ''
            }`}
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
            <div className="plp-load-more">
              <button
                type="button"
                className="plp-load-more__btn"
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
            <p className="search-page__limit-notice" role="status">
              {t('searchPage.offsetLimitReached')}
            </p>
          )}
        </>
      )}

      {showEmptyResults && (
        <section className="plp-empty">
          <h2 className="plp-empty__title">
            {t('searchPage.emptyResultsTitle')} <strong>{activeQuery}</strong>
          </h2>
          <p className="plp-empty__text">{t('searchPage.emptyResultsTip')}</p>
          <Link to="/" className="plp-empty__reset-btn search-page__catalog-link">
            {t('searchPage.backToCatalog')}
          </Link>
        </section>
      )}
    </main>
  );
}

/**
 * Dedicated lazy-loaded Search Results Page (/search) backed by React InstantSearch
 * (`useSearchBox`, `useInfiniteHits`, `useInstantSearch`) and `ProductRepository`.
 * Driven by the `?q=` URL parameter updated from the unified global header SearchBar.
 */
export function SearchResultsPage() {
  const repository = useProductRepository();
  const [searchParams] = useSearchParams();
  const urlQuery = useMemo(
    () => parseSearchUrlQuery(searchParams),
    [searchParams],
  );
  const [initialUrlQuery] = useState<string>(() => urlQuery);

  const searchClient = useMemo(
    () => createStorefrontSearchClient(repository),
    [repository],
  );

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
