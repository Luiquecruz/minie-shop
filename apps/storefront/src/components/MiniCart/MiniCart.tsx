import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CartItem as CartItemType } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useCurrency } from '../../hooks/useCurrency';
import { useDebounce } from '../../hooks/useDebounce';
import { useStockValidationQuery } from '../../hooks/useProducts';
import './MiniCart.css';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  warning?: string;
}

/**
 * Individual Cart Item with debounced React Query availability check and guardrails.
 */
function CartItem({ item, onUpdateQuantity, onRemove, warning }: CartItemProps) {
  const { formatPrice } = useCurrency();
  const [localWarning, setLocalWarning] = useState<string | null>(null);
  const [hasEditedQuantity, setHasEditedQuantity] = useState(false);

  const debouncedQuantity = useDebounce(item.quantity, 300);
  const shouldValidate = hasEditedQuantity && debouncedQuantity === item.quantity;
  const stockQuery = useStockValidationQuery(
    item.slug,
    debouncedQuantity,
    shouldValidate,
  );

  const apiStockWarning =
    shouldValidate && stockQuery.data && !stockQuery.data.available
      ? stockQuery.data.message
      : shouldValidate && stockQuery.isError
        ? 'Could not validate stock right now.'
        : null;

  const activeWarning = localWarning ?? apiStockWarning ?? warning ?? null;
  const isValidating = shouldValidate && stockQuery.isFetching;

  const maxStock = typeof item.stock === 'number' ? item.stock : 99;
  const productPath = `/${item.categorySlug}/${item.slug}`;
  const thumbSrc =
    item.image?.variants[0]?.url ?? item.image?.variants[1]?.url ?? '';

  const handleIncrement = (): void => {
    if (item.quantity >= maxStock) {
      setLocalWarning(`Maximum stock reached (${maxStock} units).`);
      return;
    }
    setLocalWarning(null);
    setHasEditedQuantity(true);
    onUpdateQuantity(item.id, item.quantity + 1);
  };

  const handleDecrement = (): void => {
    if (item.quantity <= 1) {
      return;
    }
    setLocalWarning(null);
    setHasEditedQuantity(true);
    onUpdateQuantity(item.id, item.quantity - 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const rawValue = e.target.value;
    if (rawValue === '') return;

    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      setLocalWarning(null);
      setHasEditedQuantity(true);
      onUpdateQuantity(item.id, 1);
      return;
    }

    if (parsed > maxStock) {
      setHasEditedQuantity(true);
      onUpdateQuantity(item.id, maxStock);
      setLocalWarning(`Only ${maxStock} units available in stock.`);
      return;
    }

    setLocalWarning(null);
    setHasEditedQuantity(true);
    onUpdateQuantity(item.id, parsed);
  };

  const itemTotalCents = item.price.amount * item.quantity;

  return (
    <li className="mini-cart__item" data-product-id={item.id}>
      {thumbSrc ? (
        <img
          src={thumbSrc}
          alt=""
          aria-hidden="true"
          className="mini-cart__item-image"
        />
      ) : (
        <div
          className="mini-cart__item-image mini-cart__item-image--empty"
          aria-hidden="true"
        />
      )}

      <div className="mini-cart__item-info">
        <div className="mini-cart__item-top">
          <span className="mini-cart__item-category">{item.categorySlug}</span>
          <button
            type="button"
            className="mini-cart__item-remove"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.name} from cart`}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <Link
          to={productPath}
          className="mini-cart__item-title"
          title={item.name}
        >
          {item.name}
        </Link>

        <div className="mini-cart__item-pricing">
          <span className="mini-cart__item-total">
            {formatPrice(itemTotalCents, item.price.currency)}
          </span>
          {item.quantity > 1 && (
            <span className="mini-cart__item-unit-price">
              ({formatPrice(item.price.amount, item.price.currency)} each)
            </span>
          )}
        </div>

        {activeWarning && (
          <div className="mini-cart__item-warning" role="alert">
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
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

        <div className="mini-cart__quantity-row">
          <div className="mini-cart__qty-selector">
            <button
              type="button"
              className="mini-cart__qty-btn"
              onClick={handleDecrement}
              disabled={item.quantity <= 1}
              aria-label="Decrease quantity"
            >
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
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
              min="1"
              max={maxStock}
              value={item.quantity}
              onChange={handleInputChange}
              className="mini-cart__qty-input"
              aria-label="Product quantity"
            />

            <button
              type="button"
              className="mini-cart__qty-btn"
              onClick={handleIncrement}
              disabled={item.quantity >= maxStock}
              aria-label="Increase quantity"
            >
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          </div>

          <span className="mini-cart__stock-hint">{maxStock} available</span>

          {isValidating && (
            <span
              className="mini-cart__validating-spin"
              aria-label="Validating stock..."
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
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
      </div>
    </li>
  );
}

export function MiniCart() {
  const {
    items,
    isOpen,
    cartCount,
    subtotal,
    stockWarnings,
    updateQuantity,
    removeFromCart,
    closeCart,
  } = useCart();

  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        closeCart();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeCart]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCheckout = (): void => {
    setFeedbackNotice('Checkout flow will be available in the next release.');
    setTimeout(() => setFeedbackNotice(''), 3500);
  };

  const handleViewCart = (): void => {
    closeCart();
    navigate('/cart');
  };

  if (!isOpen) return null;

  return (
    <div
      className="mini-cart-overlay"
      onClick={closeCart}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={drawerRef}
        className="mini-cart"
        onClick={(e) => e.stopPropagation()}
        aria-label="Shopping Cart Drawer"
      >
        <header className="mini-cart__header">
          <div className="mini-cart__header-title-wrapper">
            <h2 className="mini-cart__title">Your Cart</h2>
            <span className="mini-cart__badge">{cartCount}</span>
          </div>

          <button
            type="button"
            className="mini-cart__close-btn"
            onClick={closeCart}
            aria-label="Close cart drawer"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {feedbackNotice && (
          <div className="mini-cart__notice" role="status">
            <span>{feedbackNotice}</span>
          </div>
        )}

        <div className="mini-cart__body">
          {items.length === 0 ? (
            <div className="mini-cart__empty">
              <h3 className="mini-cart__empty-title">Your cart is empty</h3>
              <p className="mini-cart__empty-desc">
                Looks like you haven&apos;t added any products to your cart yet.
              </p>
              <button
                type="button"
                className="mini-cart__btn mini-cart__btn--primary"
                onClick={closeCart}
              >
                Explore Catalog
              </button>
            </div>
          ) : (
            <ul className="mini-cart__items-list">
              {items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeFromCart}
                  warning={stockWarnings[item.id]}
                />
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="mini-cart__footer">
            <div className="mini-cart__totals">
              <div className="mini-cart__total-row">
                <span className="mini-cart__total-label">Subtotal</span>
                <span className="mini-cart__total-val">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <div className="mini-cart__total-row mini-cart__total-row--final">
                <span className="mini-cart__total-label mini-cart__total-label--bold">
                  Total
                </span>
                <span className="mini-cart__total-val mini-cart__total-val--large">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <span className="mini-cart__tax-note">
                Shipping and taxes calculated during checkout.
              </span>
            </div>

            <div className="mini-cart__actions">
              <button
                type="button"
                className="mini-cart__btn mini-cart__btn--primary"
                onClick={handleCheckout}
              >
                <span>Proceed to Checkout</span>
              </button>

              <button
                type="button"
                className="mini-cart__btn mini-cart__btn--secondary"
                onClick={handleViewCart}
              >
                <span>View Full Cart</span>
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

export default MiniCart;
