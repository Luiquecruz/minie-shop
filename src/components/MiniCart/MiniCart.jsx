import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../hooks/useCart.js';
import { useCurrency } from '../../hooks/useCurrency.js';
import { productsApi } from '../../services/api.js';
import './MiniCart.css';

/**
 * Individual Cart Item with debounced stock validation and guardrails.
 */
function CartItem({ item, onUpdateQuantity, onRemove, warning }) {
  const { formatPrice } = useCurrency();
  const [localWarning, setLocalWarning] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const debounceRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Active warning derived from local validation override or parent store warning
  const activeWarning = localWarning !== null ? localWarning : (warning || null);

  const maxStock = typeof item.stock === 'number' ? item.stock : 99;

  // Debounced stock validation
  const validateQuantity = useCallback(
    (targetQty) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsValidating(true);

      debounceRef.current = setTimeout(async () => {
        try {
          const res = await productsApi.validateStock(item.id, targetQty, controller.signal);
          if (!controller.signal.aborted) {
            setIsValidating(false);
            if (!res.available) {
              setLocalWarning(res.message);
            } else {
              setLocalWarning(null);
            }
          }
        } catch (err) {
          if (err.name !== 'AbortError' && !controller.signal.aborted) {
            setIsValidating(false);
          }
        }
      }, 300);
    },
    [item.id],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleIncrement = () => {
    if (item.quantity >= maxStock) {
      setLocalWarning(`Maximum stock reached (${maxStock} units).`);
      return;
    }
    const nextQty = item.quantity + 1;
    onUpdateQuantity(item.id, nextQty);
    validateQuantity(nextQty);
  };

  const handleDecrement = () => {
    // Guardrail: prevent negative or zero items
    if (item.quantity <= 1) {
      return;
    }
    const nextQty = item.quantity - 1;
    onUpdateQuantity(item.id, nextQty);
    validateQuantity(nextQty);
  };

  const handleInputChange = (e) => {
    const rawValue = e.target.value;
    if (rawValue === '') return;

    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      // Guardrail: enforce minimum of 1
      onUpdateQuantity(item.id, 1);
      validateQuantity(1);
      return;
    }

    if (parsed > maxStock) {
      onUpdateQuantity(item.id, maxStock);
      setLocalWarning(`Only ${maxStock} units available in stock.`);
      validateQuantity(maxStock);
      return;
    }

    onUpdateQuantity(item.id, parsed);
    validateQuantity(parsed);
  };

  const itemTotal = (item.price?.final_price || 0) * item.quantity;

  return (
    <li className="mini-cart__item" data-product-id={item.id}>
      <img
        src={item.image}
        alt=""
        aria-hidden="true"
        className="mini-cart__item-image"
      />

      <div className="mini-cart__item-info">
        <div className="mini-cart__item-top">
          <span className="mini-cart__item-category">{item.category}</span>
          <button
            type="button"
            className="mini-cart__item-remove"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.name} from cart`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <Link
          to={`/product/${item.id}`}
          className="mini-cart__item-title"
          title={item.name}
        >
          {item.name}
        </Link>

        {/* Price display */}
        <div className="mini-cart__item-pricing">
          <span className="mini-cart__item-total">
            {formatPrice(itemTotal)}
          </span>
          {item.quantity > 1 && (
            <span className="mini-cart__item-unit-price">
              ({formatPrice(item.price?.final_price || 0)} each)
            </span>
          )}
        </div>

        {/* Stock warning notification */}
        {activeWarning && (
          <div className="mini-cart__item-warning" role="alert">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{activeWarning}</span>
          </div>
        )}

        {/* Quantity Controls with Guardrails */}
        <div className="mini-cart__quantity-row">
          <div className="mini-cart__qty-selector">
            <button
              type="button"
              className="mini-cart__qty-btn"
              onClick={handleDecrement}
              disabled={item.quantity <= 1}
              aria-label="Decrease quantity"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
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
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>

          <span className="mini-cart__stock-hint">
            {maxStock} available
          </span>

          {isValidating && (
            <span className="mini-cart__validating-spin" aria-label="Validating stock...">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
  const drawerRef = useRef(null);
  const [feedbackNotice, setFeedbackNotice] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeCart();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeCart]);

  // Trap scroll on body when open on mobile
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

  const handleCheckout = () => {
    setFeedbackNotice('Checkout flow will be available in the next release.');
    setTimeout(() => setFeedbackNotice(''), 3500);
  };

  const handleViewCart = () => {
    setFeedbackNotice('Dedicated cart page is under development.');
    setTimeout(() => setFeedbackNotice(''), 3500);
  };

  if (!isOpen) return null;

  return (
    <div className="mini-cart-overlay" onClick={closeCart} aria-modal="true" role="dialog">
      <div
        ref={drawerRef}
        className="mini-cart"
        onClick={(e) => e.stopPropagation()}
        aria-label="Shopping Cart Drawer"
      >
        {/* Header */}
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
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Feedback message banner */}
        {feedbackNotice && (
          <div className="mini-cart__notice" role="status">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span>{feedbackNotice}</span>
          </div>
        )}

        {/* Items List or Empty State */}
        <div className="mini-cart__body">
          {items.length === 0 ? (
            <div className="mini-cart__empty">
              <div className="mini-cart__empty-icon">
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
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

        {/* Footer with Subtotal, Total and Action CTAs */}
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
              {/* Primary CTA: Finalize purchase */}
              <button
                type="button"
                className="mini-cart__btn mini-cart__btn--primary"
                onClick={handleCheckout}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <span>Proceed to Checkout</span>
              </button>

              {/* Secondary action: Go to cart */}
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
