import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { ProductCardDTO } from '@minieshop/contracts';
import { useI18n } from '../../i18n';
import ProductCard from '../ProductCard/ProductCard';

export interface RecommendationCarouselProps {
  title: string;
  items: ProductCardDTO[];
  isLoading?: boolean;
  isError?: boolean;
  errorCode?: string | null;
  showErrorDebug?: boolean;
  skeletonCount?: number;
  onAddToCart?: (product: ProductCardDTO) => void;
  onFavoriteError?: (error: Error) => void;
  testId?: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reusable accessible horizontal recommendation carousel (`R05.4`).
 * - Native horizontal scrolling + CSS scroll-snap (`overscroll-x-contain`).
 * - Prev/Next buttons disabled cleanly at track boundaries with focus redirection.
 * - Horizontal-only `onFocusCapture` scrolling so keyboard Tab stays visible without page jumps.
 * - Zero-CLS loading skeleton and silent collapse on empty results or production errors.
 */
export function RecommendationCarousel({
  title,
  items,
  isLoading = false,
  isError = false,
  errorCode = null,
  showErrorDebug = false,
  skeletonCount = 4,
  onAddToCart,
  onFavoriteError,
  testId,
}: RecommendationCarouselProps) {
  const { t } = useI18n();
  const headingId = useId();
  const trackRef = useRef<HTMLUListElement | null>(null);
  const prevBtnRef = useRef<HTMLButtonElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveNavRef = useRef<'prev' | 'next' | null>(null);

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const syncBoundaryState = useCallback((): void => {
    const track = trackRef.current;
    if (!track) {
      setShowControls(false);
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }

    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    const hasOverflow = maxScrollLeft > 2;
    const prevAvailable = hasOverflow && track.scrollLeft > 2;
    const nextAvailable = hasOverflow && track.scrollLeft < maxScrollLeft - 2;

    setShowControls(hasOverflow);
    setCanScrollPrev(prevAvailable);
    setCanScrollNext(nextAvailable);
  }, []);

  useEffect(() => {
    if (isError) {
      console.warn(
        `[RecommendationCarousel] Failed to load "${title}"${
          errorCode ? ` (${errorCode})` : ''
        }`,
      );
    }
  }, [isError, title, errorCode]);

  useEffect(() => {
    syncBoundaryState();

    const track = trackRef.current;
    window.addEventListener('resize', syncBoundaryState);

    if (!track || typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', syncBoundaryState);
      };
    }

    const observer = new ResizeObserver(() => {
      syncBoundaryState();
    });
    observer.observe(track);

    return () => {
      window.removeEventListener('resize', syncBoundaryState);
      observer.disconnect();
    };
  }, [items, isLoading, syncBoundaryState]);

  // Redirect focus to the opposite control if the currently focused nav button becomes disabled.
  useEffect(() => {
    if (
      lastActiveNavRef.current === 'prev' &&
      !canScrollPrev &&
      canScrollNext &&
      showControls
    ) {
      lastActiveNavRef.current = 'next';
      nextBtnRef.current?.focus();
    } else if (
      lastActiveNavRef.current === 'next' &&
      !canScrollNext &&
      canScrollPrev &&
      showControls
    ) {
      lastActiveNavRef.current = 'prev';
      prevBtnRef.current?.focus();
    }
  }, [canScrollPrev, canScrollNext, showControls]);

  const scrollByStep = (direction: -1 | 1): void => {
    const track = trackRef.current;
    if (!track) return;

    const firstSlide = track.firstElementChild as HTMLElement | null;
    const computedGap =
      typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
        ? Number.parseFloat(window.getComputedStyle(track).columnGap || '16') || 16
        : 16;

    const slideWidth = firstSlide ? firstSlide.getBoundingClientRect().width : 0;
    const visibleStep = Math.max(track.clientWidth * 0.85, slideWidth + computedGap);
    const delta = direction * (visibleStep > 0 ? visibleStep : 320);

    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    const targetLeft = Math.max(
      0,
      Math.min(maxScrollLeft, track.scrollLeft + delta),
    );
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';

    if (typeof track.scrollTo === 'function') {
      track.scrollTo({ left: targetLeft, behavior });
    } else {
      track.scrollLeft = targetLeft;
    }

    if (behavior === 'auto' || typeof track.scrollTo !== 'function') {
      track.scrollLeft = targetLeft;
      syncBoundaryState();
    }
  };

  const handleTrackFocusCapture = (
    event: React.FocusEvent<HTMLUListElement>,
  ): void => {
    const track = trackRef.current;
    const target = event.target as HTMLElement | null;
    if (!track || !target || target === track) return;

    const slide = target.closest('.rec-carousel__slide') as HTMLElement | null;
    if (!slide || !track.contains(slide)) return;

    const trackRect = track.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    if (trackRect.width <= 0 || slideRect.width <= 0) return;

    let nextScrollLeft: number | null = null;
    if (slideRect.left < trackRect.left) {
      nextScrollLeft = Math.max(
        0,
        track.scrollLeft - (trackRect.left - slideRect.left) - 8,
      );
    } else if (slideRect.right > trackRect.right) {
      const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
      nextScrollLeft = Math.min(
        maxScrollLeft,
        track.scrollLeft + (slideRect.right - trackRect.right) + 8,
      );
    }

    if (nextScrollLeft === null) return;

    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
    if (typeof track.scrollTo === 'function') {
      track.scrollTo({ left: nextScrollLeft, behavior });
    } else {
      track.scrollLeft = nextScrollLeft;
    }
  };

  if (isError && items.length === 0) {
    if (!showErrorDebug) {
      return null;
    }
    return (
      <div
        className="inline-flex items-center rounded-lg border border-warning-border bg-warning-bg px-3 py-1.5 font-mono text-xs font-semibold text-warning"
        data-testid={testId ? `${testId}-dev-error` : 'recs-dev-error'}
      >
        {t('recommendations.devErrorBadge', {
          code: errorCode ?? 'UNKNOWN',
        })}
      </div>
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <section
        className="rec-carousel flex w-full flex-col gap-4"
        aria-labelledby={headingId}
        aria-busy="true"
        data-testid={testId}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id={headingId} className="m-0 text-xl font-extrabold tracking-tight text-fg-heading">
            {title}
          </h2>
        </div>

        <div
          className="rec-carousel__track scrollbar-none flex gap-4 overflow-x-auto pb-2"
          aria-label={t('recommendations.loadingAria', { title })}
        >
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <div
              key={index}
              className="rec-carousel__slide w-[260px] shrink-0 sm:w-[280px]"
              aria-hidden="true"
            >
              <div className="rec-skeleton-card overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="skeleton-shimmer aspect-[4/3] w-full" />
                <div className="flex flex-col gap-3 p-4">
                  <div className="skeleton-shimmer h-3.5 w-1/3 rounded-md" />
                  <div className="skeleton-shimmer h-5 w-4/5 rounded-md" />
                  <div className="skeleton-shimmer h-4 w-full rounded-md" />
                  <div className="skeleton-shimmer h-4 w-2/5 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="rec-carousel flex w-full flex-col gap-4"
      aria-labelledby={headingId}
      aria-roledescription={t('recommendations.carouselRoleDescription')}
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id={headingId} className="m-0 text-xl font-extrabold tracking-tight text-fg-heading">
          {title}
        </h2>

        {showControls && (
          <div className="flex items-center gap-2">
            <button
              ref={prevBtnRef}
              type="button"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-fg-heading shadow-card-sm transition-colors hover:border-brand-border hover:bg-surface-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                lastActiveNavRef.current = 'prev';
                scrollByStep(-1);
              }}
              onFocus={() => {
                lastActiveNavRef.current = 'prev';
              }}
              onBlur={(event) => {
                if (event.currentTarget.disabled) {
                  return;
                }
                const nextFocused = event.relatedTarget as Node | null;
                if (nextFocused !== nextBtnRef.current) {
                  lastActiveNavRef.current = null;
                }
              }}
              disabled={!canScrollPrev}
              aria-label={t('recommendations.previousAria', { title })}
              title={t('recommendations.previousLabel')}
            >
              <svg
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <button
              ref={nextBtnRef}
              type="button"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-fg-heading shadow-card-sm transition-colors hover:border-brand-border hover:bg-surface-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                lastActiveNavRef.current = 'next';
                scrollByStep(1);
              }}
              onFocus={() => {
                lastActiveNavRef.current = 'next';
              }}
              onBlur={(event) => {
                if (event.currentTarget.disabled) {
                  return;
                }
                const nextFocused = event.relatedTarget as Node | null;
                if (nextFocused !== prevBtnRef.current) {
                  lastActiveNavRef.current = null;
                }
              }}
              disabled={!canScrollNext}
              aria-label={t('recommendations.nextAria', { title })}
              title={t('recommendations.nextLabel')}
            >
              <svg
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      <ul
        ref={trackRef}
        className="rec-carousel__track scrollbar-none m-0 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain p-0 pb-2"
        onScroll={syncBoundaryState}
        onFocusCapture={handleTrackFocusCapture}
      >
        {items.map((product) => (
          <li
            key={product.id}
            className="rec-carousel__slide w-[260px] shrink-0 snap-start sm:w-[280px]"
          >
            <ProductCard
              product={product}
              onAddToCart={onAddToCart}
              onFavoriteError={onFavoriteError}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default RecommendationCarousel;
