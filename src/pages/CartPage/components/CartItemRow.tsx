import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CartItem } from '../../../types';
import { useCartPageContext } from '../../../context/cartPageState';
import { useCurrency } from '../../../hooks/useCurrency';
import { useDebounce } from '../../../hooks/useDebounce';
import { useStockValidationQuery } from '../../../hooks/useProducts';

export interface CartItemRowProps {
  item: CartItem;
}

/**
 * Individual CartPage line item consuming the monolithic CartPageContext.
 * Includes quantity guardrails (1..stock) and debounced React Query stock validation.
 */
export function CartItemRow({ item }: CartItemRowProps) {
  const { state, updateQuantity, removeItem } = useCartPageContext();
  const { formatPrice } = useCurrency();

  const [localWarning, setLocalWarning] = useState<string | null>(null);
  const [hasEditedQuantity, setHasEditedQuantity] = useState(false);

  const debouncedQuantity = useDebounce(item.quantity, 300);
  const stockQuery = useStockValidationQuery(
    item.id,
    debouncedQuantity,
    hasEditedQuantity,
  );

  const apiStockWarning =
    hasEditedQuantity && stockQuery.data && !stockQuery.data.available
      ? stockQuery.data.message
      : hasEditedQuantity && stockQuery.isError
        ? 'Could not validate stock right now.'
        : null;

  const activeWarning =
    localWarning ?? apiStockWarning ?? state.stockWarnings[item.id] ?? null;
  const isValidating = hasEditedQuantity && stockQuery.isFetching;

  const maxStock = typeof item.stock === 'number' ? item.stock : 99;
  const unitFinalPrice = item.price?.final_price || 0;
  const unitRegularPrice = item.price?.regular_price || 0;
  const lineTotal = unitFinalPrice * item.quantity;

  const handleIncrement = (): void => {
    if (item.quantity >= maxStock) {
      setLocalWarning(`Maximum stock reached (${maxStock} units).`);
      return;
    }
    setLocalWarning(null);
    setHasEditedQuantity(true);
    updateQuantity(item.id, item.quantity + 1);
  };

  const handleDecrement = (): void => {
    if (item.quantity <= 1) return;
    setLocalWarning(null);
    setHasEditedQuantity(true);
    updateQuantity(item.id, item.quantity - 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const rawValue = e.target.value;
    if (rawValue === '') return;

    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      setLocalWarning(null);
      setHasEditedQuantity(true);
      updateQuantity(item.id, 1);
      return;
    }

    if (parsed > maxStock) {
      setHasEditedQuantity(true);
      updateQuantity(item.id, maxStock);
      setLocalWarning(`Only ${maxStock} units available in stock.`);
      return;
    }

    setLocalWarning(null);
    setHasEditedQuantity(true);
    updateQuantity(item.id, parsed);
  };

  return (
    <li className="cart-item" data-product-id={item.id}>
      <Link
        to={`/product/${item.id}`}
        className="cart-item__image-link"
        aria-label={`View ${item.name}`}
      >
        <img
          src={item.image}
          alt={item.name}
          className="cart-item__image"
          loading="lazy"
        />
      </Link>

      <div className="cart-item__content">
        <div className="cart-item__meta-row">
          <span className="cart-item__category">{item.category}</span>

          <div className="cart-item__meta-right">
            <button
              type="button"
              className="cart-item__remove-btn"
              onClick={() => removeItem(item.id)}
              aria-label={`Remove ${item.name} from cart`}
            >
              <svg
                width="16"
                height="16"
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
              <span>Remove</span>
            </button>
          </div>
        </div>

        <Link to={`/product/${item.id}`} className="cart-item__title">
          {item.name}
        </Link>

        <div className="cart-item__unit-pricing">
          <span className="cart-item__unit-current">
            {formatPrice(unitFinalPrice)} each
          </span>
          {item.price.has_discount && (
            <>
              <span className="cart-item__unit-regular">
                {formatPrice(unitRegularPrice)}
              </span>
              <span className="cart-item__discount-badge">
                -{item.price.discount_percentage}%
              </span>
            </>
          )}
        </div>

        {activeWarning && (
          <div className="cart-alert cart-alert--warning" role="alert">
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
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <span>{activeWarning}</span>
          </div>
        )}

        <div className="cart-item__bottom-row">
          <div className="cart-item__qty-group">
            <div className="cart-item__qty-stepper">
              <button
                type="button"
                className="cart-item__qty-btn"
                onClick={handleDecrement}
                disabled={item.quantity <= 1}
                aria-label={`Decrease quantity for ${item.name}`}
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 12h-15"
                  />
                </svg>
              </button>

              <input
                type="number"
                min={1}
                max={maxStock}
                value={item.quantity}
                onChange={handleInputChange}
                className="cart-item__qty-input"
                aria-label={`Quantity for ${item.name}`}
              />

              <button
                type="button"
                className="cart-item__qty-btn"
                onClick={handleIncrement}
                disabled={item.quantity >= maxStock}
                aria-label={`Increase quantity for ${item.name}`}
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </button>
            </div>

            <span className="cart-item__stock-hint">{maxStock} in stock</span>

            {isValidating && (
              <span
                className="cart-item__validating"
                aria-label="Validating stock"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    opacity="0.3"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </span>
            )}
          </div>

          <div className="cart-item__line-total-group">
            <span className="cart-item__line-total-label">Line Total</span>
            <span className="cart-item__line-total">
              {formatPrice(lineTotal)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

export default CartItemRow;
