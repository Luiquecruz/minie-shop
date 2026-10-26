import PriceBox from '../PriceBox/PriceBox.jsx';
import './ProductCard.css';

export function ProductCard({ product, onAddToCart }) {
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

  return (
    <article className="product-card" data-product-id={id}>
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

      <div className="product-card__content">
        <div className="product-card__rating" aria-label={`Rating ${rating.rate} out of 5 stars`}>
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
          <span className="product-card__rating-value">{rating.rate.toFixed(1)}</span>
          <span className="product-card__rating-count">({rating.count})</span>
        </div>

        <h3 className="product-card__title" title={name}>
          {name}
        </h3>

        <p className="product-card__description" title={description}>
          {description}
        </p>

        <div className="product-card__footer">
          <PriceBox price={price} size="md" />

          <button
            type="button"
            className="product-card__btn"
            onClick={() => onAddToCart && onAddToCart(product)}
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
