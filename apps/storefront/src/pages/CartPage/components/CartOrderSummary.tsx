import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCartSummaryState } from '../../../hooks/useCart';
import { useCurrency } from '../../../hooks/useCurrency';
import { useI18n } from '../../../i18n';
import type { ShippingMethodId } from '../../../types';

export interface CartOrderSummaryProps {
  isTotalsLoading?: boolean;
  hasCurrencyMismatch?: boolean;
  quoteError?: string | null;
}

/**
 * Memoized sticky order summary sidebar driven by memoized Redux selectors.
 */
export const CartOrderSummary = memo(function CartOrderSummary({
  isTotalsLoading = false,
  hasCurrencyMismatch = false,
  quoteError = null,
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
  const { t } = useI18n();
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

  const getShippingName = (id: ShippingMethodId, fallback: string): string => {
    switch (id) {
      case 'standard':
        return t('cart.shipping.standard.name');
      case 'express':
        return t('cart.shipping.express.name');
      case 'pickup':
        return t('cart.shipping.pickup.name');
      default:
        return fallback;
    }
  };

  const progressRatio =
    freeShippingThresholdCents > 0
      ? Math.min(100, Math.round((subtotal / freeShippingThresholdCents) * 100))
      : 100;

  const handleCheckout = (): void => {
    if (noticeTimerRef.current !== null) {
      clearTimeout(noticeTimerRef.current);
    }
    setCheckoutNotice(t('cart.checkoutNotice'));
    noticeTimerRef.current = setTimeout(() => {
      setCheckoutNotice('');
      noticeTimerRef.current = null;
    }, 4000);
  };

  return (
    <aside
      className="flex h-fit flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-card-sm lg:sticky lg:top-20"
      aria-labelledby="cart-summary-heading"
    >
      <div className="border-b border-border-subtle pb-3">
        <h2
          id="cart-summary-heading"
          className="m-0 text-lg font-extrabold text-fg-heading"
        >
          {t('cart.summaryHeading')}
        </h2>
      </div>

      {shippingMethod === 'standard' &&
        !appliedCoupon?.freeShipping &&
        !hasCurrencyMismatch && (
          <div className="flex flex-col gap-2 rounded-xl border border-brand-border bg-brand-subtle p-3.5">
            <div className="text-xs font-medium text-fg-heading">
              {freeShippingRemaining > 0 ? (
                <span>
                  {t('cart.freeShippingAddMoreBefore')}
                  <strong className="font-bold text-brand">
                    {formatPrice(freeShippingRemaining)}
                  </strong>
                  {t('cart.freeShippingAddMoreAfter')}
                </span>
              ) : (
                <span className="font-semibold text-success">
                  {t('cart.freeShippingUnlocked')}
                </span>
              )}
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-surface-chip"
              role="progressbar"
              aria-valuenow={progressRatio}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('cart.freeShippingProgressAria')}
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-300"
                style={{ width: `${progressRatio}%` }}
              />
            </div>
          </div>
        )}

      <dl className="m-0 flex flex-col gap-3 text-sm" aria-busy={isTotalsLoading}>
        <div className="flex items-center justify-between gap-2 text-fg">
          <dt>{t('cart.subtotalWithUnits', { count: totalUnits })}</dt>
          <dd className="m-0 font-semibold tabular-nums text-fg-heading">
            {isTotalsLoading ? (
              <span
                className="skeleton-shimmer inline-block h-4 w-20 rounded-md"
                aria-label={t('cart.updatingSubtotal')}
              />
            ) : hasCurrencyMismatch ? (
              '—'
            ) : (
              formatPrice(subtotal)
            )}
          </dd>
        </div>

        {appliedCoupon && discountAmount > 0 && (
          <div className="flex items-center justify-between gap-2 text-success">
            <dt>{t('cart.promoLine', { code: appliedCoupon.code })}</dt>
            <dd className="m-0 font-bold tabular-nums">
              {isTotalsLoading ? (
                <span
                  className="skeleton-shimmer inline-block h-4 w-20 rounded-md"
                  aria-label={t('cart.updatingDiscount')}
                />
              ) : hasCurrencyMismatch ? (
                '—'
              ) : (
                `-${formatPrice(discountAmount)}`
              )}
            </dd>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-fg">
          <dt>
            {t('cart.shippingLine', {
              name: getShippingName(selectedShipping.id, selectedShipping.name),
            })}
          </dt>
          <dd className="m-0 font-semibold tabular-nums text-fg-heading">
            {isTotalsLoading ? (
              <span
                className="skeleton-shimmer inline-block h-4 w-20 rounded-md"
                aria-label={t('cart.updatingShipping')}
              />
            ) : hasCurrencyMismatch ? (
              '—'
            ) : shippingCost === 0 ? (
              <span className="font-bold text-success">
                {t('cart.shippingFree')}
              </span>
            ) : (
              formatPrice(shippingCost)
            )}
          </dd>
        </div>

        {orderNote.trim() && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-fg-muted">
            <dt className="shrink-0 font-semibold text-fg-heading">
              {t('cart.noteAttached')}
            </dt>
            <dd className="m-0 truncate" title={orderNote}>
              {orderNote}
            </dd>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <dt className="text-base font-extrabold text-fg-heading">
            {t('cart.estimatedTotal')}
          </dt>
          <dd className="m-0 text-xl font-extrabold tabular-nums text-fg-heading">
            {isTotalsLoading ? (
              <span
                className="skeleton-shimmer inline-block h-6 w-24 rounded-md"
                aria-label={t('cart.updatingEstimatedTotal')}
              />
            ) : hasCurrencyMismatch ? (
              '—'
            ) : (
              formatPrice(total)
            )}
          </dd>
        </div>
      </dl>

      {checkoutNotice && (
        <div
          className="flex items-center gap-2 rounded-xl border border-info-border bg-info-bg px-3.5 py-2.5 text-xs font-medium text-info"
          role="status"
        >
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

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-card-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleCheckout}
          disabled={isTotalsLoading || hasCurrencyMismatch || quoteError !== null}
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
          <span>{t('cart.proceedToCheckout')}</span>
        </button>

        <Link
          to="/"
          className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-surface-subtle px-5 py-2.5 text-sm font-semibold text-fg-heading no-underline transition-colors hover:bg-surface-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t('cart.continueShopping')}
        </Link>
      </div>
    </aside>
  );
});

export default CartOrderSummary;
