import { memo } from 'react';
import {
  EMPTY_COUPON_ERROR,
  extractInvalidCouponCode,
  PROMO_COUPONS,
  useCartActions,
  useCartPromoState,
} from '../../../hooks/useCart';
import { useI18n } from '../../../i18n';
import { cn } from '../../../utils/cn';

const SUGGESTED_CODES = Object.keys(PROMO_COUPONS);

/**
 * Memoized promo coupon panel subscribed only to promo coupon slice fields.
 */
export const CartPromoBox = memo(function CartPromoBox() {
  const { couponInput, appliedCoupon, couponError } = useCartPromoState();
  const { setCouponInput, applyCoupon, removeCoupon } = useCartActions();
  const { t } = useI18n();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    applyCoupon();
  };

  const getCouponLabel = (code: string, fallback: string): string => {
    if (code === 'MINIE10') return t('cart.promo.MINIE10');
    if (code === 'MINIE20') return t('cart.promo.MINIE20');
    if (code === 'FREESHIP') return t('cart.promo.FREESHIP');
    return fallback;
  };

  const invalidCouponCode = extractInvalidCouponCode(couponError);
  const displayCouponError =
    couponError === EMPTY_COUPON_ERROR
      ? t('cart.promo.emptyError')
      : invalidCouponCode
        ? t('cart.promo.invalidError', { code: invalidCouponCode })
        : couponError;

  return (
    <section
      className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-5 shadow-card-sm"
      aria-labelledby="cart-promo-heading"
    >
      <div className="flex items-center justify-between">
        <h2 id="cart-promo-heading" className="m-0 text-base font-bold text-fg-heading">
          {t('cart.promoHeading')}
        </h2>
      </div>

      <form className="flex gap-2" onSubmit={handleSubmit}>
        <label htmlFor="cart-coupon-input" className="sr-only">
          {t('cart.promoInputLabel')}
        </label>
        <input
          id="cart-coupon-input"
          type="text"
          value={couponInput}
          onChange={(e) => setCouponInput(e.target.value)}
          placeholder={t('cart.promoPlaceholder')}
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-input px-3 text-sm text-fg-heading placeholder:text-fg-muted focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          className="h-10 shrink-0 cursor-pointer rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t('cart.promoApply')}
        </button>
      </form>

      <div className="flex flex-wrap gap-2" aria-label={t('cart.promoChipsAria')}>
        {SUGGESTED_CODES.map((code) => (
          <button
            key={code}
            type="button"
            className={cn(
              'cursor-pointer rounded-lg border px-2.5 py-1 font-mono text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-brand',
              appliedCoupon?.code === code
                ? 'border-brand-border bg-brand-subtle text-brand'
                : 'border-border bg-surface-chip text-fg-heading hover:bg-surface-chip-hover',
            )}
            onClick={() => applyCoupon(code)}
          >
            {code}
          </button>
        ))}
      </div>

      {appliedCoupon && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-success-border bg-success-bg px-3.5 py-2.5"
          role="status"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-extrabold text-success">
              {appliedCoupon.code}
            </span>
            <span className="text-xs text-fg">
              {getCouponLabel(appliedCoupon.code, appliedCoupon.label)}
            </span>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg-heading hover:bg-surface-chip"
            onClick={removeCoupon}
            aria-label={t('cart.promoRemoveAria', { code: appliedCoupon.code })}
          >
            {t('cart.promoRemove')}
          </button>
        </div>
      )}

      {displayCouponError && (
        <div
          className="flex items-center gap-2 rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-xs font-medium text-danger"
          role="alert"
        >
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
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span>{displayCouponError}</span>
        </div>
      )}
    </section>
  );
});

export default CartPromoBox;
