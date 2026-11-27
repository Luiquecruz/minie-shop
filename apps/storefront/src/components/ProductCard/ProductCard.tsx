import { Link } from 'react-router-dom';
import type { ProductCardDTO } from '@minieshop/contracts';
import { useCartActions } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';
import { useI18n } from '../../i18n';
import AttributeIcon from '../AttributeIcon/AttributeIcon';
import PriceBox from '../PriceBox/PriceBox';
import ProductImage from '../ProductImage/ProductImage';
import './ProductCard.css';

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
    <article className="product-card" data-product-id={id} data-product-slug={slug}>
      <div className="product-card__media">
        <Link
          to={productPath}
          className="product-card__image-link"
          aria-label={t('card.viewDetails', { name })}
        >
          <div className="product-card__image-container">
            <span className="product-card__category">{categorySlug}</span>
            <span className="product-card__stock-badge">
              {inStock ? t('card.inStock') : t('card.outOfStock')}
            </span>
            <ProductImage
              image={image}
              productName={name}
              aspectRatio="4 / 3"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
              className="product-card__image"
            />
          </div>
        </Link>

        <button
          type="button"
          className={`product-card__favorite-btn ${
            favorited ? 'product-card__favorite-btn--active' : ''
          }`}
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

      <div className="product-card__content">
        <Link to={productPath} className="product-card__title-link">
          <h3 className="product-card__title" title={name}>
            {name}
          </h3>
        </Link>

        {highlights.length > 0 && (
          <ul
            className="product-card__highlights"
            aria-label={t('card.highlightsAria')}
          >
            {highlights.slice(0, 3).map((attr) => (
              <li key={attr.code} className="product-card__highlight-item">
                <AttributeIcon iconKey={attr.icon} size={14} />
                <span>
                  {attr.label}: {formatAttributeHighlight(attr.value, attr.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="product-card__footer">
          <PriceBox price={price} size="md" />

          <button
            type="button"
            className="product-card__btn"
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
              className="product-card__btn-icon"
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
