import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';
import PriceBox from '../PriceBox/PriceBox';
import './ProductCard.css';

export interface ProductCardProps {
  product: Product | null | undefined;
  onFavoriteError?: (error: Error) => void;
  onAddToCart?: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart, onFavoriteError }: ProductCardProps) {
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites(onFavoriteError);

  if (!product) return null;

  const {
    id,
    name,
    price,
    category,
    image,
    description,
    rating = { rate: 0, count: 0 },
    stock,
  } = product;

  const favorited = isFavorite(id);

  return (
    <article className="product-card" data-product-id={id}>
      <div className="product-card__media">
        <Link
          to={`/product/${id}`}
          className="product-card__image-link"
          aria-label={`View ${name} details`}
        >
          <div className="product-card__image-container">
            <span className="product-card__category">{category}</span>
            {typeof stock === 'number' && (
              <span className="product-card__stock-badge">
                {stock > 0 ? `${stock} in stock` : 'Out of stock'}
              </span>
            )}
            <img
              src={image}
              alt={name}
              loading="lazy"
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
              ? `Remove ${name} from favorites`
              : `Add ${name} to favorites`
          }
          title={favorited ? 'Remove from favorites' : 'Save to favorites'}
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
        <div
          className="product-card__rating"
          aria-label={`Rating ${rating.rate} out of 5 stars`}
        >
          <span className="product-card__stars" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </span>
          <span className="product-card__rating-value">
            {rating.rate.toFixed(1)}
          </span>
          <span className="product-card__rating-count">({rating.count})</span>
        </div>

        <Link to={`/product/${id}`} className="product-card__title-link">
          <h3 className="product-card__title" title={name}>
            {name}
          </h3>
        </Link>

        <p className="product-card__description" title={description}>
          {description}
        </p>

        <div className="product-card__footer">
          <PriceBox price={price} size="md" />

          <button
            type="button"
            className="product-card__btn"
            onClick={() => {
              if (onAddToCart) {
                onAddToCart(product);
              } else {
                addToCart(product);
              }
            }}
            aria-label={`Add ${name} to cart`}
          >
            <svg
              className="product-card__btn-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
