import { useState, type CSSProperties } from 'react';
import type { ImageDTO } from '@minieshop/contracts';
import { useI18n } from '../../i18n';
import './ProductImage.css';

export interface ProductImageProps {
  image: ImageDTO | null | undefined;
  productName: string;
  sizes?: string;
  aspectRatio?: string;
  priority?: boolean;
  decorative?: boolean;
  className?: string;
}

/**
 * Resilient product image component (ADR-0005):
 * - Renders inline SVG fallback directly when `image` is null or has no variants (0 network calls).
 * - On `onError`, transitions to inline SVG fallback via React state (never mutating `src`).
 * - Automatically resets error state whenever the resolved `src` changes.
 * - Reserves explicit `aspect-ratio` and paints API base64 `placeholder` to avoid CLS.
 */
export function ProductImage({
  image,
  productName,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px',
  aspectRatio = '4 / 3',
  priority = false,
  decorative = false,
  className = '',
}: ProductImageProps) {
  const { t } = useI18n();
  const variants = image?.variants ?? [];
  const sortedVariants = [...variants].sort((a, b) => a.width - b.width);
  const primaryVariant =
    sortedVariants[sortedVariants.length - 1] ?? sortedVariants[0];
  const primarySrc = primaryVariant?.url ?? '';

  const [prevSrc, setPrevSrc] = useState<string>(primarySrc);
  const [hasFailed, setHasFailed] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  if (prevSrc !== primarySrc) {
    setPrevSrc(primarySrc);
    setHasFailed(false);
    setIsLoaded(false);
  }

  const srcSet =
    sortedVariants.length > 0
      ? sortedVariants.map((v) => `${v.url} ${v.width}w`).join(', ')
      : undefined;

  const hasValidImage = Boolean(image && primarySrc.length > 0);
  const showFallback = !hasValidImage || hasFailed;

  const resolvedAlt = decorative
    ? ''
    : image?.alt && image.alt.trim().length > 0
      ? image.alt
      : productName;

  const fallbackLabel = t('image.unavailable');

  const containerStyle: CSSProperties = {
    aspectRatio,
    ...(!showFallback && !isLoaded && image?.placeholder
      ? { backgroundImage: `url("${image.placeholder}")` }
      : {}),
  };

  return (
    <div
      className={`product-image ${
        showFallback ? 'product-image--fallback' : ''
      } ${isLoaded ? 'product-image--loaded' : ''} ${className}`.trim()}
      style={containerStyle}
    >
      {showFallback ? (
        <div
          className="product-image__fallback"
          role={decorative ? undefined : 'img'}
          aria-label={decorative ? undefined : fallbackLabel}
          aria-hidden={decorative ? true : undefined}
        >
          <svg
            className="product-image__fallback-svg"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="8" y="12" width="48" height="40" rx="6" />
            <circle cx="23" cy="25" r="4" />
            <path d="M56 41l-12-12-13 13-6-6-17 16" />
          </svg>
          {!decorative && (
            <span className="product-image__fallback-label">
              {fallbackLabel}
            </span>
          )}
        </div>
      ) : (
        <img
          src={primarySrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={resolvedAlt}
          aria-hidden={decorative ? true : undefined}
          width={primaryVariant?.width ?? image?.width ?? undefined}
          height={primaryVariant?.height ?? image?.height ?? undefined}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          className="product-image__img"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasFailed(true)}
        />
      )}
    </div>
  );
}

export default ProductImage;
