import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CartItem as CartItemType } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useCartQuoteSync } from '../../hooks/useCartQuoteSync';
import { useCurrency } from '../../hooks/useCurrency';
import { useDebounce } from '../../hooks/useDebounce';
import { useStockValidationQuery } from '../../hooks/useProducts';
import { useI18n } from '../../i18n';
import ProductImage from '../ProductImage/ProductImage';
import './MiniCart.css';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  warning?: string;
  isPriceLoading?: boolean;
}

/**
 * Individual Cart Item with debounced React Query availability check and guardrails.
 */
function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
  warning,
  isPriceLoading = false,
}: CartItemProps) {
  const { formatPrice } = useCurrency();
  const { t } = useI18n();
  const [localWarning, setLocalWarning] = useState<{
    key: 'cart.maxStockReached' | 'cart.onlyAvailableInStock';
    max: number;
  } | null>(null);
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
        ? t('cart.stockValidateError')
        : null;

  const translatedPropWarning =
    warning === 'This product is currently out of stock.'
      ? t('cart.outOfStockWarning')
      : warning;

  const translatedLocalWarning = localWarning
    ? t(localWarning.key, { max: localWarning.max })
    : null;

  const activeWarning =
    translatedLocalWarning ?? apiStockWarning ?? translatedPropWarning ?? null;
  const isValidating = shouldValidate && stockQuery.isFetching;

  const maxStock = typeof item.stock === 'number' ? item.stock : 99;
  const productPath = `/${item.categorySlug}/${item.slug}`;

  const handleIncrement = (): void => {
    if (item.quantity >= maxStock) {
      setLocalWarning({ key: 'cart.maxStockReached', max: maxStock });
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
      setLocalWarning({ key: 'cart.onlyAvailableInStock', max: maxStock });
      return;
    }

    setLocalWarning(null);
    setHasEditedQuantity(true);
    onUpdateQuantity(item.id, parsed);
  };

  const itemTotalCents = item.price.amount * item.quantity;

  return (
    <li className="mini-cart__item" data-product-id={item.id}>
      <ProductImage
        image={item.image}
        productName={item.name}
        aspectRatio="1 / 1"
        sizes="72px"
        decorative
        className="mini-cart__item-image"
      />

      <div className="mini-cart__item-info">
        <div className="mini-cart__item-top">
          <span className="mini-cart__item-category">{item.categorySlug}</span>
          <button
            type="button"
            className="mini-cart__item-remove"
            onClick={() => onRemove(item.id)}
            aria-label={t('miniCart.removeItemAria', { name: item.name })}
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

        <div className="mini-cart__item-pricing" aria-busy={isPriceLoading}>
          {isPriceLoading ? (
            <span
              className="mini-cart__shimmer mini-cart__shimmer--price"
              aria-label={t('miniCart.updatingItemPrice')}
            />
          ) : (
            <>
              <span className="mini-cart__item-total">
                {formatPrice(itemTotalCents, item.price.currency)}
              </span>
              {item.quantity > 1 && (
                <span className="mini-cart__item-unit-price">
                  {t('miniCart.unitPriceEach', {
                    price: formatPrice(item.price.amount, item.price.currency),
                  })}
                </span>
              )}
            </>
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
              aria-label={t('cart.decreaseQty')}
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
              aria-label={t('cart.qtyLabel')}
            />

            <button
              type="button"
              className="mini-cart__qty-btn"
              onClick={handleIncrement}
              disabled={item.quantity >= maxStock}
              aria-label={t('cart.increaseQty')}
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

          <span className="mini-cart__stock-hint">
            {t('miniCart.availableCount', { count: maxStock })}
          </span>

          {isValidating && (
            <span
              className="mini-cart__validating-spin"
              aria-label={t('cart.validatingStockEllipsis')}
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

  const { currentCurrency, formatPrice } = useCurrency();
  const { t } = useI18n();
  const {
    hasCurrencyMismatch,
    isTotalsLoading,
    quoteError,
    retryQuote,
    isItemPriceLoading,
  } = useCartQuoteSync(isOpen);
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
    setFeedbackNotice(t('miniCart.checkoutNotice'));
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
        aria-label={t('miniCart.drawerAria')}
      >
        <header className="mini-cart__header">
          <div className="mini-cart__header-title-wrapper">
            <h2 className="mini-cart__title">{t('miniCart.title')}</h2>
            <span className="mini-cart__badge">{cartCount}</span>
          </div>

          <button
            type="button"
            className="mini-cart__close-btn"
            onClick={closeCart}
            aria-label={t('miniCart.closeAria')}
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

        {quoteError && (
          <div className="mini-cart__quote-error" role="alert">
            <span>{quoteError}</span>
            <button
              type="button"
              className="mini-cart__retry-btn"
              onClick={retryQuote}
            >
              {t('cart.retry')}
            </button>
          </div>
        )}

        <div className="mini-cart__body">
          {items.length === 0 ? (
            <div className="mini-cart__empty">
              <h3 className="mini-cart__empty-title">
                {t('miniCart.emptyTitle')}
              </h3>
              <p className="mini-cart__empty-desc">
                {t('miniCart.emptyDesc')}
              </p>
              <button
                type="button"
                className="mini-cart__btn mini-cart__btn--primary"
                onClick={closeCart}
              >
                {t('miniCart.exploreCatalog')}
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
                  isPriceLoading={isItemPriceLoading(item.price.currency)}
                />
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="mini-cart__footer">
            <div className="mini-cart__totals" aria-busy={isTotalsLoading}>
              <span
                className="mini-cart__sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {isTotalsLoading
                  ? t('miniCart.liveUpdatingTotals', {
                      currency: currentCurrency,
                    })
                  : quoteError
                    ? ''
                    : t('miniCart.liveSubtotalUpdated', {
                        currency: currentCurrency,
                        amount: formatPrice(subtotal, currentCurrency),
                      })}
              </span>
              <div className="mini-cart__total-row">
                <span className="mini-cart__total-label">
                  {t('miniCart.subtotal')}
                </span>
                <span className="mini-cart__total-val">
                  {isTotalsLoading ? (
                    <span
                      className="mini-cart__shimmer mini-cart__shimmer--total"
                      aria-label={t('miniCart.updatingSubtotal')}
                    />
                  ) : (
                    formatPrice(subtotal, currentCurrency)
                  )}
                </span>
              </div>
              <div className="mini-cart__total-row mini-cart__total-row--final">
                <span className="mini-cart__total-label mini-cart__total-label--bold">
                  {t('miniCart.total')}
                </span>
                <span className="mini-cart__total-val mini-cart__total-val--large">
                  {isTotalsLoading ? (
                    <span
                      className="mini-cart__shimmer mini-cart__shimmer--total-lg"
                      aria-label={t('miniCart.updatingTotal')}
                    />
                  ) : (
                    formatPrice(subtotal, currentCurrency)
                  )}
                </span>
              </div>
              <span className="mini-cart__tax-note">
                {t('miniCart.taxNote')}
              </span>
            </div>

            <div className="mini-cart__actions">
              <button
                type="button"
                className="mini-cart__btn mini-cart__btn--primary"
                onClick={handleCheckout}
                disabled={isTotalsLoading || hasCurrencyMismatch}
              >
                <span>{t('miniCart.proceedToCheckout')}</span>
              </button>

              <button
                type="button"
                className="mini-cart__btn mini-cart__btn--secondary"
                onClick={handleViewCart}
              >
                <span>{t('miniCart.viewFullCart')}</span>
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

export default MiniCart;
