import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCartSummaryState } from '../../../hooks/useCart';
import { useCurrency } from '../../../hooks/useCurrency';

export interface CartOrderSummaryProps {
  isTotalsLoading?: boolean;
  hasCurrencyMismatch?: boolean;
}

/**
 * Memoized sticky order summary sidebar driven by memoized Redux selectors.
 */
export const CartOrderSummary = memo(function CartOrderSummary({
  isTotalsLoading = false,
  hasCurrencyMismatch = false,
}: CartOrderSummaryProps) {
  const {
    totalUnits,
    subtotal,
    discountAmount,
    shippingCost,
    freeShippingRemaining,
    freeShippingThresholdCents,
    shippingOptions,
    total,
    appliedCoupon,
    shippingMethod,
    orderNote,
  } = useCartSummaryState();
  const { formatPrice } = useCurrency();
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const selectedShipping =
    shippingOptions.find((opt) => opt.id === shippingMethod) ??
    shippingOptions[0];

  const progressRatio =
    freeShippingThresholdCents > 0
      ? Math.min(100, Math.round((subtotal / freeShippingThresholdCents) * 100))
      : 100;

  const handleCheckout = (): void => {
    if (noticeTimerRef.current !== null) {
      clearTimeout(noticeTimerRef.current);
    }
    setCheckoutNotice(
      'Checkout flow will be added in the next Phase 6 increment.',
    );
    noticeTimerRef.current = setTimeout(() => {
      setCheckoutNotice('');
      noticeTimerRef.current = null;
    }, 4000);
  };

  return (
    <aside className="cart-summary" aria-labelledby="cart-summary-heading">
      <div className="cart-panel__header">
        <h2 id="cart-summary-heading" className="cart-summary__title">
          Order Summary
        </h2>
      </div>

      {shippingMethod === 'standard' && !appliedCoupon?.freeShipping && (
        <div className="cart-summary__shipping-progress">
          <div className="cart-summary__progress-text">
            {freeShippingRemaining > 0 ? (
              <span>
                Add <strong>{formatPrice(freeShippingRemaining)}</strong> more
                for free Standard Delivery
              </span>
            ) : (
              <span>You unlocked free Standard Delivery!</span>
            )}
          </div>
          <div
            className="cart-summary__progress-track"
            role="progressbar"
            aria-valuenow={progressRatio}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Free standard shipping threshold progress"
          >
            <div
              className="cart-summary__progress-fill"
              style={{ width: `${progressRatio}%` }}
            />
          </div>
        </div>
      )}

      <dl className="cart-summary__breakdown" aria-busy={isTotalsLoading}>
        <div className="cart-summary__row">
          <dt>Subtotal ({totalUnits} units)</dt>
          <dd>
            {isTotalsLoading ? (
              <span
                className="cart-shimmer cart-shimmer--summary"
                aria-label="Updating subtotal"
              />
            ) : (
              formatPrice(subtotal)
            )}
          </dd>
        </div>

        {appliedCoupon && discountAmount > 0 && (
          <div className="cart-summary__row cart-summary__row--discount">
            <dt>Promo ({appliedCoupon.code})</dt>
            <dd>
              {isTotalsLoading ? (
                <span
                  className="cart-shimmer cart-shimmer--summary"
                  aria-label="Updating discount"
                />
              ) : (
                `-${formatPrice(discountAmount)}`
              )}
            </dd>
          </div>
        )}

        <div className="cart-summary__row">
          <dt>Shipping ({selectedShipping.name})</dt>
          <dd>
            {isTotalsLoading ? (
              <span
                className="cart-shimmer cart-shimmer--summary"
                aria-label="Updating shipping"
              />
            ) : shippingCost === 0 ? (
              <span className="cart-summary__free-tag">Free</span>
            ) : (
              formatPrice(shippingCost)
            )}
          </dd>
        </div>

        {orderNote.trim() && (
          <div className="cart-summary__note-preview">
            <dt>Note attached</dt>
            <dd title={orderNote}>{orderNote}</dd>
          </div>
        )}

        <div className="cart-summary__row cart-summary__row--total">
          <dt>Estimated Total</dt>
          <dd>
            {isTotalsLoading ? (
              <span
                className="cart-shimmer cart-shimmer--summary-total"
                aria-label="Updating estimated total"
              />
            ) : (
              formatPrice(total)
            )}
          </dd>
        </div>
      </dl>

      {checkoutNotice && (
        <div className="cart-alert cart-alert--info" role="status">
          <svg
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <span>{checkoutNotice}</span>
        </div>
      )}

      <div className="cart-summary__actions">
        <button
          type="button"
          className="cart-btn cart-btn--primary"
          onClick={handleCheckout}
          disabled={isTotalsLoading || hasCurrencyMismatch}
        >
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
            />
          </svg>
          <span>Proceed to Checkout</span>
        </button>

        <Link to="/" className="cart-btn cart-btn--secondary">
          Continue Shopping
        </Link>
      </div>
    </aside>
  );
});

export default CartOrderSummary;
