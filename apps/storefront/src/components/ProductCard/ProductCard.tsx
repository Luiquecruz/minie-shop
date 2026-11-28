import { Link } from 'react-router-dom';
import type { ProductCardDTO } from '@minieshop/contracts';
import { useCartActions } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';
import { useI18n } from '../../i18n';
import { cn } from '@minieshop/ui/tokens';
import AttributeIcon from '../AttributeIcon/AttributeIcon';
import PriceBox from '../PriceBox/PriceBox';
import ProductImage from '../ProductImage/ProductImage';

export interface ProductCardProps {
  product: ProductCardDTO | null | undefined;
  onFavoriteError?: (error: Error) => void;
  onAddToCart?: (product: ProductCardDTO) => void;
}

export function ProductCard({
  product,
  onAddToCart,
  onFavoriteError,
}: ProductCardProps) {
  const { addToCart } = useCartActions();
  const { isFavorite, toggleFavorite } = useFavorites(onFavoriteError);
  const { t } = useI18n();

  const formatAttributeHighlight = (
    value: string | number | boolean,
    unit?: string,
  ): string => {
    if (typeof value === 'boolean') {
      return value ? t('filters.yes') : t('filters.no');
    }
    return unit ? `${value} ${unit}` : String(value);
  };

  if (!product) return null;

  const {
    id,
    slug,
    name,
    price,
    categorySlug,
    image,
    inStock,
    highlights,
  } = product;

  const productPath = `/${categorySlug}/${slug}`;
  const favorited = isFavorite(id);

  return (
    <article
      className="product-card group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-border hover:shadow-card-md"
      data-product-id={id}
      data-product-slug={slug}
    >
      <div className="relative overflow-hidden bg-surface-subtle">
        <Link
          to={productPath}
          className="block no-underline"
          aria-label={t('card.viewDetails', { name })}
        >
          <div className="relative">
            <span className="absolute left-3 top-3 z-10 rounded-full border border-border bg-surface/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg-heading backdrop-blur-sm">
              {categorySlug}
            </span>
            <span
              className={cn(
                'absolute bottom-3 left-3 z-10 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm',
                inStock
                  ? 'border-success-border bg-surface/90 text-success'
                  : 'border-danger-border bg-surface/90 text-danger',
              )}
            >
              {inStock ? t('card.inStock') : t('card.outOfStock')}
            </span>
            <ProductImage
              image={image}
              productName={name}
              aspectRatio="4 / 3"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
              className="transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        </Link>

        <button
          type="button"
          className={cn(
            'product-card__favorite-btn absolute right-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border bg-surface/90 shadow-card-sm backdrop-blur-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            favorited
              ? 'border-danger-border text-danger'
              : 'border-border text-fg-muted hover:border-danger-border hover:text-danger',
          )}
          onClick={() => toggleFavorite(id)}
          aria-pressed={favorited}
          aria-label={
            favorited
              ? t('card.removeFavoriteAria', { name })
              : t('card.addFavoriteAria', { name })
          }
          title={favorited ? t('card.removeFavorite') : t('card.saveFavorite')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={favorited ? 'currentColor' : 'none'}
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
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link to={productPath} className="product-card__title-link no-underline">
          <h3
            className="product-card__title line-clamp-2 min-h-[2.6rem] text-base font-bold leading-snug text-fg-heading transition-colors group-hover:text-brand"
            title={name}
          >
            {name}
          </h3>
        </Link>

        {highlights.length > 0 && (
          <ul
            className="m-0 flex list-none flex-wrap gap-1.5 p-0"
            aria-label={t('card.highlightsAria')}
          >
            {highlights.slice(0, 3).map((attr) => (
              <li
                key={attr.code}
                className="inline-flex items-center gap-1 rounded-lg bg-surface-chip px-2 py-1 text-xs font-medium text-fg"
              >
                <AttributeIcon iconKey={attr.icon} size={14} />
                <span>
                  {attr.label}: {formatAttributeHighlight(attr.value, attr.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <PriceBox price={price} size="md" />

          <button
            type="button"
            className="product-card__btn inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-card-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-surface-chip disabled:text-fg-muted disabled:shadow-none"
            disabled={!inStock}
            onClick={() => {
              if (onAddToCart) {
                onAddToCart(product);
              } else {
                addToCart(product);
              }
            }}
            aria-label={t('card.addToCartAria', { name })}
          >
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {inStock ? t('card.addToCart') : t('card.outOfStock')}
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
