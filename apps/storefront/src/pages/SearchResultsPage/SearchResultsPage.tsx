import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
import {
  MAX_SEARCH_QUERY_LENGTH,
  parseSearchUrlQuery,
  serializeSearchUrlQuery,
} from '../../utils/searchUrlParams';
import ProductCard from '../../components/ProductCard/ProductCard';
import './SearchResultsPage.css';

const SEARCH_INPUT_DEBOUNCE_MS = 450;

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
  onUpdateUrl: (nextQuery: string, replace: boolean) => void;
}

function SearchResultsContent({
  urlQuery,
  onUpdateUrl,
}: SearchResultsContentProps) {
  useConfigure({ hitsPerPage: SEARCH_HITS_PER_PAGE });

  const inputId = useId();
  const { query, refine } = useSearchBox();
  const { items, results, isLastPage, showMore } =
    useInfiniteHits<StorefrontSearchHit>();
  const { status, error, refresh } = useInstantSearch({ catchError: true });
  const { addToCart } = useCart();
  const { t } = useI18n();

  const [draftQuery, setDraftQuery] = useState<string>(urlQuery);
  const [favoriteError, setFavoriteError] = useState<Error | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [prevStatus, setPrevStatus] = useState(status);

  if (prevStatus !== status) {
    setPrevStatus(status);
    if (status === 'idle' || status === 'error') {
      setIsLoadingMore(false);
    }
  }

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedUrlQueryRef = useRef<string>(urlQuery);
  const onUpdateUrlRef = useRef(onUpdateUrl);

  useEffect(() => {
    onUpdateUrlRef.current = onUpdateUrl;
  }, [onUpdateUrl]);

  // Cancel any pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Sync external URL navigation (Back/Forward or header link) into InstantSearch
  useEffect(() => {
    if (urlQuery === lastSyncedUrlQueryRef.current) {
      return;
    }
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    lastSyncedUrlQueryRef.current = urlQuery;
    refine(urlQuery);
  }, [urlQuery, refine]);

  const [prevUrlQuery, setPrevUrlQuery] = useState<string>(urlQuery);
  if (prevUrlQuery !== urlQuery) {
    setPrevUrlQuery(urlQuery);
    setDraftQuery(urlQuery);
  }

  // Auto-dismiss favorite rollback notice
  useEffect(() => {
    if (!favoriteError) return;
    const timer = setTimeout(() => setFavoriteError(null), 4000);
    return () => clearTimeout(timer);
  }, [favoriteError]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const nextValue = event.target.value;
    setDraftQuery(nextValue);

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const normalized = nextValue.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
      if (normalized === lastSyncedUrlQueryRef.current) {
        return;
      }
      lastSyncedUrlQueryRef.current = normalized;
      onUpdateUrlRef.current(normalized, true);
      refine(normalized);
    }, SEARCH_INPUT_DEBOUNCE_MS);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const normalized = draftQuery.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
    const shouldPushUrl = normalized !== urlQuery;
    lastSyncedUrlQueryRef.current = normalized;
    if (shouldPushUrl) {
      onUpdateUrl(normalized, false);
    }
    if (normalized !== query.trim() || status === 'error') {
      refine(normalized);
    }
  };

  const handleClear = (): void => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setDraftQuery('');
    lastSyncedUrlQueryRef.current = '';
    onUpdateUrl('', false);
    refine('');
  };

  const handleShowMore = (): void => {
    setIsLoadingMore(true);
    showMore();
  };

  const handleRetry = (): void => {
    const targetQuery =
      urlQuery || draftQuery.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
    if (targetQuery && targetQuery !== query.trim()) {
      // InstantSearch's index widget rolls helper.state back to lastValidSearchParameters
      // when a request fails; re-refine with the active URL/draft query to retry it.
      refine(targetQuery);
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
    hasActiveQuery && !isErrorState && isFetching && (!isQueryMatch || items.length === 0);
  const showResultsGrid =
    hasActiveQuery && !isErrorState && !showInitialSkeleton && items.length > 0;
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

        <form
          className="search-page__form"
          role="search"
          onSubmit={handleSubmit}
        >
          <label htmlFor={inputId} className="visually-hidden">
            {t('searchPage.inputLabel')}
          </label>
          <div className="search-page__input-wrap">
            <span className="search-page__icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
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
            </span>

            <input
              id={inputId}
              type="search"
              name="q"
              maxLength={MAX_SEARCH_QUERY_LENGTH}
              className="search-page__input"
              placeholder={t('searchPage.inputPlaceholder')}
              value={draftQuery}
              onChange={handleInputChange}
            />

            {draftQuery.length > 0 && (
              <button
                type="button"
                className="search-page__clear-btn"
                onClick={handleClear}
                aria-label={t('search.clearAria')}
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
            )}
          </div>

          <button type="submit" className="search-page__submit-btn">
            {t('searchPage.submitButton')}
          </button>
        </form>
      </header>

      {hasActiveQuery && (
        <div className="search-page__toolbar">
          <div className="search-page__summary">
            {showResultsGrid && (
              <span className="search-page__count">
                {t('searchPage.showingOf', {
                  loaded: items.length,
                  total: estimatedTotal,
                  query: activeQuery,
                })}
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
            {t('searchPage.emptyResultsTitle', { query: activeQuery })}
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
 */
export function SearchResultsPage() {
  const repository = useProductRepository();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = useMemo(
    () => parseSearchUrlQuery(searchParams),
    [searchParams],
  );
  const [initialUrlQuery] = useState<string>(() => urlQuery);

  const searchClient = useMemo(
    () => createStorefrontSearchClient(repository),
    [repository],
  );

  const handleUpdateUrl = (nextQuery: string, replace: boolean): void => {
    setSearchParams(serializeSearchUrlQuery(nextQuery), { replace });
  };

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
      <SearchResultsContent
        urlQuery={urlQuery}
        onUpdateUrl={handleUpdateUrl}
      />
    </InstantSearch>
  );
}

export default SearchResultsPage;
